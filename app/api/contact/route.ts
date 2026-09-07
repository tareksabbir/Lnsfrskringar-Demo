import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomUUID } from 'node:crypto'
import { allowSubmission, saveSubmission, contactStoreIsDurable } from '@/lib/contactStore'

/**
 * Receives a contact-form submission.
 *
 * The form is ours because this instance has no Optimizely Forms add-on — see
 * cms/content-types/OT_ContactForm.ts. Which means the validation, the rate
 * limiting and the privacy decisions are ours too.
 *
 * ── What this deliberately does not do ──────────────────────────────────────
 *  - Does not email anyone. No mail service is configured, and inventing one
 *    would mean another credential and another place a stranger's message ends
 *    up. Submissions are read in Opti-Admin.
 *  - Does not write to the CMS. Content is published; a message from a stranger
 *    is not content, and the content tree has no retention policy.
 *  - Does not log field values. Only counts and outcomes reach the log — an
 *    access log is exactly the place personal data should not accumulate.
 *  - Does not echo the submission back. The response says it was received.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LIMITS = {
  name:    120,
  email:   200,
  subject: 160,
  message: 4_000,
} as const

/** A deliberately ordinary check: enough to catch a typo, not to police addresses. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function field(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

/**
 * A salted hash of the caller's IP, for rate limiting only.
 *
 * The salt is OPAL_TOOL_SECRET if set, otherwise a per-process value: a hash
 * with a known salt is reversible against a list of candidate addresses, and
 * the point of hashing is that the stored value identifies nobody.
 */
const FALLBACK_SALT = randomUUID()
function senderHash(req: NextRequest): string {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || req.headers.get('x-real-ip')
    || 'unknown'
  const salt = process.env.OPAL_TOOL_SECRET || FALLBACK_SALT
  return createHash('sha256').update(`${salt}:${ip}`).digest('hex').slice(0, 32)
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const b = (body ?? {}) as Record<string, unknown>

  const name    = field(b.name, LIMITS.name)
  const email   = field(b.email, LIMITS.email)
  const subject = field(b.subject, LIMITS.subject)
  const message = field(b.message, LIMITS.message)
  const consent = b.consent === true

  // A honeypot: a field no person sees and every naive bot fills. Answering 200
  // rather than an error means a bot has nothing to learn from the response.
  if (field(b.company, 100)) {
    console.info('[contact] discarded a honeypot submission')
    return NextResponse.json({ status: 'received' })
  }

  const problems: string[] = []
  if (!name) problems.push('name')
  if (!email || !EMAIL.test(email)) problems.push('email')
  if (!message) problems.push('message')
  if (!consent) problems.push('consent')

  if (problems.length) {
    // Field NAMES, never values.
    console.info(`[contact] 400: missing or invalid — ${problems.join(', ')}`)
    return NextResponse.json(
      { error: 'Please check the highlighted fields.', fields: problems },
      { status: 400 },
    )
  }

  const hash = senderHash(req)
  if (!(await allowSubmission(hash))) {
    console.warn('[contact] 429: rate limit reached for one sender')
    return NextResponse.json(
      { error: 'Too many messages from this connection. Please try again later.' },
      { status: 429 },
    )
  }

  try {
    await saveSubmission({
      id: randomUUID(),
      receivedAt: new Date().toISOString(),
      name, email, subject, message,
      pagePath: field(b.pagePath, 200) || undefined,
    })
  } catch (err) {
    console.error('[contact] could not store the submission:', err)
    return NextResponse.json(
      { error: 'We could not receive your message just now. Please try again.' },
      { status: 502 },
    )
  }

  if (!contactStoreIsDurable()) {
    // Loud, because on Vercel this means the message is already gone: each
    // request may land on a different instance and the in-memory store is not
    // shared. Silence here would let a demo look like it works.
    console.warn(
      '[contact] stored IN MEMORY — KV is not configured, so this submission '
      + 'will not be readable in Opti-Admin. Set KV_REST_API_URL / _TOKEN.',
    )
  }

  console.info('[contact] submission received')
  return NextResponse.json({ status: 'received' })
}
