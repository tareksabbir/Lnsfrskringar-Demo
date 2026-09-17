import { type NextRequest, NextResponse } from 'next/server'
import { timingSafeEqualString } from '@/lib/webhookAuth'
import {
  registerPageAssetLineage,
  resolvePublicPageUrl,
  type LineageOutcome,
} from '@/lib/assetLineage'

// CMS publish webhook → DAM asset lineage.
//
// Register this URL as a webhook in Optimizely SaaS CMS for content publish
// events. On each delivery we:
//   1. Optionally verify the `callback-secret` header (see the auth note below).
//   2. Pull the content key out of the payload.
//   3. Resolve the page's absolute public URL via Graph.
//   4. Scan every published version for DAM image references and POST one
//      lineage row per asset to CMP (lib/assetLineage.ts).
//
// So an editor who adds a DAM image to a page and publishes causes that page to
// show up under "used in" on the asset in CMP.
//
// Verified end to end against the live instance: the lineage POST returns 201 on
// the ordinary CMP_CLIENT_ID/CMP_CLIENT_SECRET app token — no user-context OAuth
// needed. What does NOT work is reading lineage back (`GET /v3/assets/{id}` and
// `GET .../lineages` are both 403 for an app token), and CMP does not
// deduplicate, so repeat publishes would pile up identical rows. That is why
// lib/assetLineage.ts keeps its own ledger of (asset, uri) pairs instead of
// asking CMP what it already has.
//
// Add `?dryRun=1` to collect and log the asset ids without calling CMP.

export const dynamic = 'force-dynamic'
export const revalidate = 0

// Reads the body without trusting the content-type header, which webhooks
// routinely get wrong: JSON first, then form encodings, then raw text
// re-parsed as JSON. Mirrors app/api/cmp-preview/route.ts.
async function readBody(req: NextRequest): Promise<unknown> {
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    try { return await req.json() } catch { /* malformed — fall through */ }
  }
  const text = await req.text()
  if (contentType.includes('application/x-www-form-urlencoded')) {
    return Object.fromEntries(new URLSearchParams(text))
  }
  try { return JSON.parse(text) } catch { return text }
}

/**
 * Digs the published item's content key out of the payload.
 *
 * The CMS publish payload shape is not pinned down here, and guessing one field
 * name would make this brittle against a schema we do not control — so we accept
 * the spellings the Optimizely APIs use elsewhere and, failing those, take any
 * 32-hex GUID found under a key-ish field name. Anything unrecognised is
 * reported as skipped with the payload logged, which is recoverable; silently
 * registering lineage against the wrong page is not.
 */
function extractContentKey(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const GUID = /^[0-9a-fA-F]{32}$/
  const NAMES = new Set([
    'contentkey', 'content_key', 'key', 'contentguid', 'content_guid',
    'contentlink', 'content_link', 'id', 'contentid', 'content_id',
  ])

  let found: string | null = null
  const visit = (node: unknown, depth: number): void => {
    if (found || depth > 8 || !node || typeof node !== 'object') return
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (found) return
      if (typeof v === 'string' && NAMES.has(k.toLowerCase()) && GUID.test(v)) {
        found = v.toLowerCase()
        return
      }
      visit(v, depth + 1)
    }
  }
  visit(body, 0)
  return found
}

type Handled = {
  contentKey: string | null
  pageUrl: string | null
  lineage: LineageOutcome
}

async function handlePublish(body: unknown, dryRun: boolean): Promise<Handled> {
  const contentKey = extractContentKey(body)
  if (!contentKey) {
    console.warn(
      '[cms-publish] no 32-hex content key found in payload — nothing to do. Payload:\n'
      + JSON.stringify(body, null, 2).slice(0, 4000),
    )
    return {
      contentKey: null,
      pageUrl: null,
      lineage: { status: 'skipped', reason: 'no content key found in payload' },
    }
  }

  const pageUrl = await resolvePublicPageUrl(contentKey)
  if (!pageUrl) {
    return {
      contentKey,
      pageUrl: null,
      lineage: {
        status: 'skipped',
        reason: `Graph has no URL for ${contentKey} (not a routable page, or not yet indexed)`,
      },
    }
  }

  const lineage = await registerPageAssetLineage({ contentKey, pageUrl, dryRun })
  return { contentKey, pageUrl, lineage }
}

// ── Auth: open by default, on purpose ───────────────────────────────────────
//
// A deliberate exception to the fail-closed rule the CMP webhooks follow, and
// the ONLY route here that runs without a shared secret. Do not copy this to a
// route that writes CMS content or returns data — the reasoning below is what
// makes it acceptable, not a general preference.
//
// This endpoint cannot be made to say anything untrue. It accepts a content key,
// not a URL and not an asset id: the page URL comes from Graph, and the asset
// ids come from that page's own published versions. So the most a stranger can
// achieve by POSTing here is to register lineage that is already correct, for a
// real page on this site, for images genuinely on it. The ledger makes a repeat
// a no-op, and nothing is read back out. The residual risk is wasted API calls.
//
// To lock it down later, fill in the webhook's optional "Add Authentication
// Token" field in the CMS UI and set CMS_CALLBACK_SECRET to the same value. CMS
// sends it as `Authorization: Bearer <token>` on every request — NOT as the
// `callback-secret` header the CMP webhooks use, which is a different product's
// convention. The `?key=` form is accepted too, for pasting the secret into the
// URL when editing headers is inconvenient.
function authorized(req: NextRequest): boolean {
  const expected = process.env.CMS_CALLBACK_SECRET
  if (!expected) return true // documented above
  const bearer = (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  const provided = bearer || req.nextUrl.searchParams.get('key') || ''
  return Boolean(provided) && timingSafeEqualString(provided, expected)
}

// ── Endpoint verification ───────────────────────────────────────────────────
//
// A new webhook stays **Pending** until the endpoint confirms a verification
// message, and CMS reports "The URL provided could not be validated" when the
// answer is not the one it wants. The shape is documented nowhere — not the
// webhook guide, not the REST reference, not the OpenAPI schema bundled with
// @optimizely/cms-cli — so this handles the two known conventions and records
// whatever actually arrives.
//
// 1. Azure Event Grid handshake. CMS (SaaS) runs on Azure, and Event Grid
//    validates a subscriber by POSTing an array whose `data` carries a
//    `validationCode`, with `aeg-event-type: SubscriptionValidation` set. It
//    requires a JSON reply of exactly {"validationResponse":"<code>"}. A
//    plain-text echo of the code does NOT satisfy it — which is what the first
//    version of this route sent, and why validation failed.
// 2. Plain challenge echo, for providers that want the raw value back as text.
//    Checked second so it can never shadow case 1.
//
// Every request is also captured in memory and served by GET, so the payload
// CMS really sends can be read off the deployed URL instead of hunting logs.
const EVENT_GRID_HEADER = 'aeg-event-type'

/** Last request this instance saw. Per-instance and lossy — a debugging aid, not a store. */
type Captured = {
  receivedAt: string
  headers: Record<string, string>
  body: unknown
  answeredWith: 'verification' | 'event'
}
const captureRef = globalThis as unknown as { __cmsPublishLast?: Captured }

/** First string value under any of `names`, at any depth. */
function findByKey(body: unknown, names: string[]): string | null {
  const want = new Set(names.map(n => n.toLowerCase()))
  let hit: string | null = null
  const visit = (node: unknown, depth: number): void => {
    if (hit || depth > 8 || !node || typeof node !== 'object') return
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (hit) return
      if (typeof v === 'string' && v && want.has(k.toLowerCase())) { hit = v; return }
      visit(v, depth + 1)
    }
  }
  visit(body, 0)
  return hit
}

const CHALLENGE_FIELDS = [
  'challenge', 'verificationToken', 'verification_token',
  'verificationCode', 'verification_code', 'token',
]

/**
 * Answers a verification request, or null when this is a real event.
 *
 * Deliberately generous about what counts as verification: mistaking an event
 * for a handshake costs one lineage pass, while failing a handshake blocks
 * every event the webhook would ever deliver.
 */
function verificationResponse(req: NextRequest, body: unknown): NextResponse | null {
  // Keyed on the code rather than the header: a gateway can drop a header, and
  // the code is the part that actually has to come back.
  const validationCode = findByKey(body, ['validationCode', 'validation_code'])
  if (validationCode) {
    console.log(
      `[cms-publish] Event Grid validation (${req.headers.get(EVENT_GRID_HEADER) ?? 'no aeg header'})`
      + ` — replying validationResponse=${validationCode}`,
    )
    return NextResponse.json({ validationResponse: validationCode })
  }

  const challenge = findByKey(body, CHALLENGE_FIELDS)
  if (challenge) {
    console.log(`[cms-publish] challenge verification — echoing ${challenge}`)
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

  return null
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    console.warn('[cms-publish] rejected — CMS_CALLBACK_SECRET is set and the request did not match')
    return NextResponse.json({ ok: false, error: 'invalid callback secret' }, { status: 401 })
  }

  const body = await readBody(req)
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'

  // Capture before doing anything, so even a request we mishandle is inspectable.
  const headers = Object.fromEntries(
    [...req.headers.entries()].filter(([k]) => k.toLowerCase() !== 'authorization'),
  )
  console.log('[cms-publish] POST\n' + JSON.stringify({ headers, body }, null, 2).slice(0, 6000))
  const capture = (answeredWith: Captured['answeredWith']) => {
    captureRef.__cmsPublishLast = { receivedAt: new Date().toISOString(), headers, body, answeredWith }
  }

  // Verification comes before anything else: it carries no content to act on,
  // and answering it wrongly leaves the webhook stuck on Pending.
  const verify = verificationResponse(req, body)
  if (verify) {
    capture('verification')
    return verify
  }
  capture('event')

  // Never let a lineage problem fail the webhook: the CMS would retry the
  // delivery, and a retry cannot fix a scope misconfiguration.
  let handled: Handled
  try {
    handled = await handlePublish(body, dryRun)
  } catch (err) {
    console.error('[cms-publish] unexpected error:', err)
    handled = {
      contentKey: null,
      pageUrl: null,
      lineage: { status: 'skipped', reason: `unexpected error: ${String(err)}` },
    }
  }

  return NextResponse.json({ ok: true, dryRun, ...handled })
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    message:
      'CMS publish webhook → CMP DAM asset lineage. Register this URL (POST) as a '
      + 'content-publish webhook in Optimizely SaaS CMS. No secret is required; '
      + 'setting CMS_CALLBACK_SECRET turns on verification (sent as the '
      + 'callback-secret header or a ?key= param). Append ?dryRun=1 to log the '
      + 'asset ids without calling CMP.',
    lastRequest: captureRef.__cmsPublishLast ?? null,
    configured: {
      secretRequired: Boolean(process.env.CMS_CALLBACK_SECRET),
      CMP_CLIENT_ID: Boolean(process.env.CMP_CLIENT_ID),
      OPTIMIZELY_CMS_CLIENT_ID: Boolean(process.env.OPTIMIZELY_CMS_CLIENT_ID),
    },
  })
}
