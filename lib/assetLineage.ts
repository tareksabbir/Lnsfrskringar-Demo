/**
 * DAM asset lineage: telling CMP which public pages use which DAM images.
 *
 * When an editor drops a DAM image into a page, the CMS stores it in the
 * composition as a reference string:
 *
 *     cms://content/DamImageSource/2f4c455aa50b11f1916b4a7836a56b60
 *
 * The trailing id is `cmp_Asset._itemMetadata.key`, which IS the CMP `asset_id`
 * (verified: GET /v3/asset-urls/{key} returns `id` equal to that key). So a
 * published page version contains everything needed to register lineage — no
 * extra lookup, no mapping table.
 *
 * ── Why a string scan rather than a typed walk ──────────────────────────────
 * Graph exposes a composition as a tree of per-block GraphQL types, so reading
 * it that way means naming every block and every image property, and silently
 * missing any block added later. The Management REST API hands back the same
 * composition as plain JSON, and in it every DAM reference has the identical
 * shape — `{ value: "cms://content/DamImageSource/<key>" }` — at whatever depth
 * the block happens to sit. Scanning for the reference pattern therefore finds
 * images in blocks this file has never heard of, which is the property that
 * matters: a lineage walker that needs editing every time someone adds a block
 * will be wrong within a month.
 *
 * The `DamImageSource/` segment is required, not optional. Ordinary CMS page
 * links are stored as `cms://content/<key>` with no segment, and treating one of
 * those as an asset id would register lineage against a page.
 */
import { publishedVersions } from '@/lib/cmsApi'
import { createAssetLineage, cmpConfigured, type CmpAssetLineageResult } from '@/lib/cmpApi'
import { getClient } from '@/lib/optimizely'

/**
 * Matches a DAM asset reference and captures the asset id.
 *
 * Global + case-insensitive: a single JSON blob holds many references, and the
 * hex is lowercase in practice but nothing guarantees it.
 */
const DAM_REF = /cms:\/\/content\/DamImageSource\/([0-9a-fA-F]{32})/g

/**
 * Every distinct DAM asset id reachable from `value`, in first-seen order.
 *
 * Takes `unknown` and walks anything: the caller passes a whole content version,
 * and the references sit at unpredictable depths inside `composition` and
 * `properties`. Order is stable so logs and dry-runs are diffable.
 */
export function collectDamAssetKeys(value: unknown): string[] {
  const found = new Set<string>()

  // One JSON.stringify would be shorter, but it throws on a circular reference
  // and silently drops non-enumerable values. An explicit walk cannot.
  const visit = (node: unknown, depth: number): void => {
    if (depth > 64) return // composition trees are shallow; this is a cycle guard
    if (typeof node === 'string') {
      // Reset lastIndex: DAM_REF is /g and shared across calls.
      DAM_REF.lastIndex = 0
      let m: RegExpExecArray | null
      while ((m = DAM_REF.exec(node)) !== null) found.add(m[1].toLowerCase())
      return
    }
    if (Array.isArray(node)) {
      for (const item of node) visit(item, depth + 1)
      return
    }
    if (node && typeof node === 'object') {
      for (const v of Object.values(node)) visit(v, depth + 1)
    }
  }

  visit(value, 0)
  return [...found]
}

/**
 * The absolute public URL of a content item, for the lineage `uri`.
 *
 * Graph is the only source that has it. The Management API returns
 * `routeSegment` — just the leaf ("home-insurance", not
 * "/product/home-insurance/") — and `simpleRoute`, which on this instance holds
 * editor-entered junk like "test1". Graph's `_metadata.url` carries both the
 * hierarchical path and the canonical `base` host the CMS resolved for the site,
 * so base + path is the URL a visitor actually sees.
 *
 * Falls back to NEXT_PUBLIC_SITE_URL / NEXT_PUBLIC_SITE_DOMAIN for the host when
 * Graph has no `base`, which happens for content not yet bound to a host.
 * Returns null when even the path is unknown — the caller then skips rather than
 * registering lineage against a guessed URL.
 */
export async function resolvePublicPageUrl(contentKey: string): Promise<string | null> {
  const QUERY = `
    query LineagePageUrl($key: String!) {
      _Content(where: { _metadata: { key: { eq: $key } } }, limit: 10) {
        items { _metadata { key locale variation url { default hierarchical base } } }
      }
    }
  `
  type Row = {
    _metadata?: {
      variation?: string | null
      url?: { default?: string | null; hierarchical?: string | null; base?: string | null }
    }
  }

  let items: Row[] = []
  try {
    const data = await getClient().request(QUERY, { key: contentKey }) as
      { _Content?: { items?: Row[] } }
    items = data?._Content?.items ?? []
  } catch (err) {
    console.error(`[lineage] Graph URL lookup failed for ${contentKey}:`, err)
    return null
  }

  // Prefer the original over a variation row: variations share the page's URL,
  // and the original is the one guaranteed to carry a canonical `base`.
  const row = items.find(i => !i._metadata?.variation) ?? items[0]
  const url = row?._metadata?.url
  const path = url?.hierarchical || url?.default
  if (!path) return null

  const fallbackHost = process.env.NEXT_PUBLIC_SITE_URL
    || (process.env.NEXT_PUBLIC_SITE_DOMAIN ? `https://${process.env.NEXT_PUBLIC_SITE_DOMAIN}` : '')
  const base = (url?.base || fallbackHost).replace(/\/$/, '')
  if (!base) return null

  return `${base}${path.startsWith('/') ? path : `/${path}`}`
}

// ─── Idempotency ledger ─────────────────────────────────────────────────────
//
// CMP does not deduplicate lineage: posting the same (asset, uri) pair twice
// creates two rows with different ids, and `GET /v3/assets/{id}/lineages` is
// 403 for an app token, so there is no way to ask CMP what it already has. A
// publish webhook without a memory would therefore add a fresh duplicate row
// for every image every time an editor republishes a page.
//
// So we remember locally. The claim is a single Redis `SET ... NX`, which is
// atomic: it succeeds for exactly one caller and tells everyone else the pair is
// already done. That matters because two publishes landing together are two
// concurrent serverless invocations, and a read-then-write check would let both
// through.
//
// Same storage convention as lib/cmpPreviewStore.ts — Upstash/Vercel KV over
// its REST API, with an in-memory fallback so `yarn dev` works. The fallback is
// per-instance, so without KV provisioned duplicates are still possible across
// cold starts; that is a demo-environment compromise, not the intended setup.

/** 90 days. Long enough that routine republishing is covered, short enough that a deleted asset's claim eventually lapses. */
const LEDGER_TTL_SECONDS = 90 * 86_400

const ledgerKey = (assetId: string, uri: string) => `cmp:lineage:${assetId}:${uri}`

function kvConfig(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url, token } : null
}

async function kvCommand(args: (string | number)[]): Promise<unknown> {
  const cfg = kvConfig()
  if (!cfg) return null
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`KV ${String(args[0])} failed: ${res.status} ${await res.text()}`)
  return ((await res.json()) as { result?: unknown }).result ?? null
}

const globalRef = globalThis as unknown as { __lineageLedger?: Set<string> }
const memLedger: Set<string> = globalRef.__lineageLedger ?? (globalRef.__lineageLedger = new Set())

/**
 * Claims an (asset, uri) pair. True means "you are the one who should POST it".
 *
 * Fails OPEN: if KV is unreachable we return true and let the POST happen. A
 * duplicate lineage row is cosmetic; silently dropping lineage because the cache
 * was down loses the thing we were asked to record.
 */
async function claimLineage(assetId: string, uri: string): Promise<boolean> {
  const key = ledgerKey(assetId, uri)
  if (!kvConfig()) {
    if (memLedger.has(key)) return false
    memLedger.add(key)
    return true
  }
  try {
    return (await kvCommand(['SET', key, '1', 'NX', 'EX', LEDGER_TTL_SECONDS])) !== null
  } catch (err) {
    console.warn('[lineage] ledger claim failed, registering anyway:', err)
    return true
  }
}

/** Releases a claim so a later publish can retry a pair whose POST failed. */
async function releaseLineage(assetId: string, uri: string): Promise<void> {
  const key = ledgerKey(assetId, uri)
  if (!kvConfig()) { memLedger.delete(key); return }
  try { await kvCommand(['DEL', key]) } catch { /* the TTL will clear it */ }
}

export type LineageRegistration = {
  assetId: string
  result: CmpAssetLineageResult
}

export type LineageOutcome =
  | { status: 'skipped'; reason: string; assetIds?: string[] }
  | {
      status: 'done'
      uri: string
      assetIds: string[]
      registered: number
      failed: number
      /** Pairs the ledger says were already sent to CMP on an earlier publish. */
      alreadyRegistered: number
      results: LineageRegistration[]
    }

export type RegisterLineageOptions = {
  /** CMS content key of the page an editor just published. */
  contentKey: string
  /** Absolute public URL of that page — becomes the lineage `uri`. */
  pageUrl: string
  /** Source name shown in CMP. Defaults to CMP_LINEAGE_SOURCE_NAME or the host. */
  sourceName?: string
  /** Optional favicon URL for the source. */
  iconUrl?: string
  /** Collect and log the asset ids without calling CMP. */
  dryRun?: boolean
}

/**
 * Registers lineage for every DAM image used by a published page.
 *
 * Reads all PUBLISHED versions of the page — a page can have several at once,
 * one per locale and one per CMS variation — and unions their asset ids. An
 * image used only by a variation is still genuinely published at this URL for
 * the visitors bucketed into it, so leaving it out would under-report. Ids are
 * deduped across versions, so each asset gets at most one POST per page.
 *
 * Best-effort by construction: every asset is attempted even if earlier ones
 * fail, and nothing here throws into a webhook response.
 */
export async function registerPageAssetLineage(
  opts: RegisterLineageOptions,
): Promise<LineageOutcome> {
  const { contentKey, pageUrl, dryRun = false } = opts

  if (!contentKey) return { status: 'skipped', reason: 'no content key in payload' }
  if (!pageUrl) return { status: 'skipped', reason: 'could not resolve a public URL for this page' }
  if (!dryRun && !cmpConfigured()) {
    return { status: 'skipped', reason: 'CMP_CLIENT_ID / CMP_CLIENT_SECRET are not set' }
  }

  const versions = await publishedVersions(contentKey)
  if (versions.length === 0) {
    // Not an error: the webhook can fire for an unpublish, or Graph/CMS may not
    // have caught up. Reporting it as skipped keeps real failures legible.
    return { status: 'skipped', reason: `no published versions found for ${contentKey}` }
  }

  const assetIds = collectDamAssetKeys(versions)
  if (assetIds.length === 0) {
    return { status: 'skipped', reason: 'page uses no DAM assets', assetIds: [] }
  }

  let sourceName = opts.sourceName || process.env.CMP_LINEAGE_SOURCE_NAME || ''
  if (!sourceName) {
    try { sourceName = new URL(pageUrl).host } catch { sourceName = 'website' }
  }

  if (dryRun) {
    console.log(
      `[lineage] DRY RUN ${contentKey} → ${pageUrl}\n`
      + assetIds.map(id => `  POST /v3/assets/${id}/lineages { name: "${sourceName}", uri: "${pageUrl}" }`).join('\n'),
    )
    return { status: 'done', uri: pageUrl, assetIds, registered: 0, failed: 0, alreadyRegistered: 0, results: [] }
  }

  // Sequential on purpose. This runs inside a publish webhook against a
  // third-party API with no documented rate limit, and a page can carry a dozen
  // images; a burst of parallel POSTs is how you find the limit the hard way.
  const results: LineageRegistration[] = []
  let alreadyRegistered = 0
  for (const assetId of assetIds) {
    if (!(await claimLineage(assetId, pageUrl))) {
      alreadyRegistered++
      continue
    }
    const result = await createAssetLineage(assetId, {
      name: sourceName,
      uri: pageUrl,
      iconUrl: opts.iconUrl || process.env.CMP_LINEAGE_ICON_URL || undefined,
    })
    // Hand the claim back on failure, otherwise a transient error would make
    // this pair permanently unregisterable for the length of the TTL.
    if (!result.ok) await releaseLineage(assetId, pageUrl)
    results.push({ assetId, result })
  }

  const registered = results.filter(r => r.result.ok).length
  const failed = results.length - registered
  console.log(
    `[lineage] ${contentKey} → ${pageUrl}: ${registered} registered, ${failed} failed, `
    + `${alreadyRegistered} already known `
    + `(${assetIds.length} DAM assets across ${versions.length} published version(s))`,
  )

  return { status: 'done', uri: pageUrl, assetIds, registered, failed, alreadyRegistered, results }
}
