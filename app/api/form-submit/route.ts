import { NextResponse } from 'next/server'
import { bumpRateCounter, putSubmission, submissionStoreIsDurable } from '@/lib/formSubmissionStore'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * Receiver for Optimizely Forms submissions.
 *
 * This is the endpoint you put in the form container's **Submit URL** property
 * (CMS → the form shared block → Edit → Properties → Submit URL → More → Edit
 * Link → External link):
 *
 *     https://<your-site>/api/form-submit
 *
 * Optimizely Forms stores nothing. The front end collects the fields and POSTs
 * them to whatever URL is configured, so persistence is entirely ours. See
 * docs.developers.optimizely.com → "Collect form data and send to webhook".
 *
 * The endpoint is deliberately PUBLIC — a visitor filling in a contact form has
 * no session and no token, so there is nothing to authenticate. That makes every
 * limit below load-bearing rather than decorative: the only thing standing
 * between this route and an open write endpoint is the size, shape and rate caps.
 */

/** Reject anything larger before parsing — a body is read into memory to parse it. */
const MAX_BODY_BYTES = 32 * 1024
const MAX_FIELDS = 40
const MAX_KEY_CHARS = 128
const MAX_VALUE_CHARS = 5_000
/** Per-IP fixed window. A person fills in a contact form once; bots do not. */
const RATE_LIMIT = 10
const RATE_WINDOW_SECONDS = 60

/** Field names are an allow-list by shape: letters, digits, and separators. */
const KEY_PATTERN = /^[\w .:@-]{1,128}$/

function clientIp(req: Request): string {
  // Vercel sets x-forwarded-for; the left-most entry is the client. Header values
  // are attacker-controlled in general, so this is a rate-limiting bucket only
  // and must never be used for authorization or trust decisions.
  const fwd = req.headers.get('x-forwarded-for') ?? ''
  const first = fwd.split(',')[0]?.trim()
  return first || req.headers.get('x-real-ip') || 'unknown'
}

/**
 * Coerce one submitted entry into a stored field, or drop it.
 *
 * Values are stored verbatim as strings and never interpolated into HTML, SQL
 * or a shell — the admin view escapes on render. Objects and arrays are dropped
 * rather than stringified: the documented payload is a flat string map, and
 * accepting nested structures is how a size cap gets bypassed by depth.
 */
function normalizeField(key: string, value: unknown): [string, string] | null {
  const k = key.trim()
  if (!KEY_PATTERN.test(k)) return null
  if (typeof value === 'string') return [k.slice(0, MAX_KEY_CHARS), value.slice(0, MAX_VALUE_CHARS)]
  if (typeof value === 'number' || typeof value === 'boolean') return [k, String(value)]
  return null
}

export async function POST(req: Request) {
  const ip = clientIp(req)

  let count: number
  try {
    count = await bumpRateCounter(ip, RATE_WINDOW_SECONDS)
  } catch (err) {
    // A rate-limiter that cannot count must not become a way to bypass it.
    console.error('[form-submit] rate counter unavailable:', err)
    return NextResponse.json({ error: 'Temporarily unavailable' }, { status: 503 })
  }
  if (count > RATE_LIMIT) {
    return NextResponse.json(
      { error: 'Too many submissions' },
      { status: 429, headers: { 'Retry-After': String(RATE_WINDOW_SECONDS) } },
    )
  }

  const declared = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }

  const contentType = req.headers.get('content-type') ?? ''
  let entries: Array<[string, unknown]>

  try {
    if (contentType.includes('application/json')) {
      const text = await req.text()
      // content-length can lie or be absent; measure what actually arrived.
      if (new TextEncoder().encode(text).length > MAX_BODY_BYTES) {
        return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
      }
      const parsed: unknown = JSON.parse(text)
      if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return NextResponse.json({ error: 'Expected a JSON object' }, { status: 400 })
      }
      entries = Object.entries(parsed as Record<string, unknown>)
    } else if (
      contentType.includes('multipart/form-data') ||
      contentType.includes('application/x-www-form-urlencoded')
    ) {
      const form = await req.formData()
      // Files are not accepted. Storing uploads from an unauthenticated endpoint
      // is a different feature with its own content-validation requirements.
      entries = [...form.entries()].map(([k, v]) => [k, typeof v === 'string' ? v : null])
    } else {
      return NextResponse.json({ error: 'Unsupported content type' }, { status: 415 })
    }
  } catch {
    // Deliberately not echoing the parser's message: it can quote the payload.
    return NextResponse.json({ error: 'Could not read the submission' }, { status: 400 })
  }

  if (entries.length > MAX_FIELDS) {
    return NextResponse.json({ error: 'Too many fields' }, { status: 400 })
  }

  const fields: Record<string, string> = {}
  let formName: string | undefined
  for (const [k, v] of entries) {
    const pair = normalizeField(k, v)
    if (!pair) continue
    if (pair[0] === '__form') {
      formName = pair[1].slice(0, 128)
      continue
    }
    fields[pair[0]] = pair[1]
  }

  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ error: 'No usable fields' }, { status: 400 })
  }

  try {
    await putSubmission({ receivedAt: new Date().toISOString(), form: formName, fields })
  } catch (err) {
    // Log the failure, never the submission — the body is visitor personal data.
    console.error('[form-submit] could not store the submission:', err)
    return NextResponse.json({ error: 'Could not store the submission' }, { status: 502 })
  }

  if (!submissionStoreIsDurable()) {
    console.warn(
      '[form-submit] stored in memory only — set KV_REST_API_URL / KV_REST_API_TOKEN '
      + 'or submissions will be lost between requests on Vercel.',
    )
  }

  // Nothing from the request is reflected back, so a probe learns only that the
  // submission was accepted.
  return NextResponse.json({ ok: true }, { status: 200 })
}

/** Answer other verbs explicitly rather than letting Next return a 405 page. */
export function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
