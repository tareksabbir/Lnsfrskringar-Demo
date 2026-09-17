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
// message CMS sends to it; only then does it go **Active**. The shape of that
// message is not in the CMS (SaaS) webhook guide, not in the REST reference, and
// not in the OpenAPI schema bundled with @optimizely/cms-cli — so rather than
// guess one shape, this route is built so that any plausible convention passes:
//
//   • it answers 200 to every request, including a body it does not recognise
//     (an unknown payload is reported as `skipped`, never as an error status);
//   • if the payload carries anything challenge-shaped, the raw value is echoed
//     back as text/plain, which is the usual "prove you received it" contract;
//   • the full payload is logged, so if the webhook does stay Pending the real
//     format is in the Vercel function logs and can be matched exactly.
//
// GET also returns 200, covering a verifier that probes rather than posts.
const CHALLENGE_FIELDS = [
  'challenge', 'validationCode', 'validation_code', 'verificationToken',
  'verification_token', 'verificationCode', 'verification_code',
]

/** The challenge value from a verification payload, if this looks like one. */
function findChallenge(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  let hit: string | null = null
  const visit = (node: unknown, depth: number): void => {
    if (hit || depth > 5 || !node || typeof node !== 'object') return
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (hit) return
      if (typeof v === 'string' && v && CHALLENGE_FIELDS.some(f => f.toLowerCase() === k.toLowerCase())) {
        hit = v
        return
      }
      visit(v, depth + 1)
    }
  }
  visit(body, 0)
  return hit
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    console.warn('[cms-publish] rejected — CMS_CALLBACK_SECRET is set and the request did not match')
    return NextResponse.json({ ok: false, error: 'invalid callback secret' }, { status: 401 })
  }

  const body = await readBody(req)
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'

  // Verification comes before anything else: it carries no content to act on,
  // and answering it wrongly leaves the webhook stuck on Pending.
  const challenge = findChallenge(body)
  if (challenge) {
    console.log(
      '[cms-publish] verification message received — echoing challenge. Payload:\n'
      + JSON.stringify(body, null, 2).slice(0, 4000),
    )
    return new NextResponse(challenge, {
      status: 200,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }

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
    configured: {
      secretRequired: Boolean(process.env.CMS_CALLBACK_SECRET),
      CMP_CLIENT_ID: Boolean(process.env.CMP_CLIENT_ID),
      OPTIMIZELY_CMS_CLIENT_ID: Boolean(process.env.OPTIMIZELY_CMS_CLIENT_ID),
    },
  })
}
