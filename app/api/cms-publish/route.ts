import { type NextRequest, NextResponse } from 'next/server'
import { verifyCallbackSecret } from '@/lib/webhookAuth'
import {
  registerPageAssetLineage,
  resolvePublicPageUrl,
  type LineageOutcome,
} from '@/lib/assetLineage'

// CMS publish webhook → DAM asset lineage.
//
// Register this URL as a webhook in Optimizely SaaS CMS for content publish
// events, with the same secret as CMS_CALLBACK_SECRET. On each delivery we:
//   1. Verify the inbound `callback-secret` header (fails closed — see
//      lib/webhookAuth.ts for why that matters).
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

export async function POST(req: NextRequest) {
  const auth = verifyCallbackSecret(req.headers, 'CMS_CALLBACK_SECRET', 'cms-publish')
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const body = await readBody(req)
  const dryRun = req.nextUrl.searchParams.get('dryRun') === '1'

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
      + 'content-publish webhook in Optimizely SaaS CMS and set CMS_CALLBACK_SECRET '
      + 'to the same secret. Append ?dryRun=1 to log the asset ids without calling CMP.',
    configured: {
      CMS_CALLBACK_SECRET: Boolean(process.env.CMS_CALLBACK_SECRET),
      CMP_CLIENT_ID: Boolean(process.env.CMP_CLIENT_ID),
      OPTIMIZELY_CMS_CLIENT_ID: Boolean(process.env.OPTIMIZELY_CMS_CLIENT_ID),
    },
  })
}
