// ─── Optimizely CMP API client ──────────────────────────────────────────────
//
// Server-to-server access to CMP via the OAuth2 client-credentials flow. Used by
// the preview webhook to acknowledge/complete a preview, to resolve a CMP
// asset (library image) to a public CDN URL, and by the OptiAdmin "Work
// Requests" demo to look up Request Type templates and file a work request.
//
// Verified against the live API:
//   • token   — POST (form-encoded) accounts.cmp.optimizely.com/o/oauth2/v1/token
//               { grant_type, client_id, client_secret } → { access_token, expires_in≈3600 }
//   • asset   — GET asset-urls/{guid} (Bearer, follow 302) → metadata JSON whose
//               `url` is a PUBLIC CDN image (is_public:true) + `alt_text`
//   • ack/cmp — POST to the absolute acknowledge/complete links from the webhook
//               payload, Bearer auth (request body shapes per documented contract)
//
// The templates/work-requests surface below is marked "Experimental" in
// Optimizely's docs — shapes are best-effort per lib/admin/cmpWorkRequests.ts,
// and the API routes log the raw response so the real contract can be confirmed
// against a live CMP instance.

import {
  normalizeTemplateSummaries,
  normalizeTemplateDetail,
  type CmpTemplateSummary,
  type CmpTemplateDetail,
} from './admin/cmpWorkRequests'

const TOKEN_URL = 'https://accounts.cmp.optimizely.com/o/oauth2/v1/token'
const API_BASE  = 'https://api.cmp.optimizely.com/v3'

// Module-scoped token cache. Survives within a warm serverless instance; a cold
// start just re-mints. Refreshed 60s before expiry.
let cachedToken: { token: string; expiresAt: number } | null = null

export function cmpConfigured(): boolean {
  return Boolean(process.env.CMP_CLIENT_ID && process.env.CMP_CLIENT_SECRET)
}

export async function getCmpAccessToken(): Promise<string> {
  const clientId = process.env.CMP_CLIENT_ID
  const clientSecret = process.env.CMP_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('CMP_CLIENT_ID / CMP_CLIENT_SECRET are not set')
  }

  const now = Date.now()
  if (cachedToken && cachedToken.expiresAt > now + 60_000) return cachedToken.token

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })
  if (!res.ok) {
    throw new Error(`CMP token mint failed: ${res.status} ${await res.text()}`)
  }
  const json = (await res.json()) as { access_token: string; expires_in?: number }
  cachedToken = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600) * 1000,
  }
  return cachedToken.token
}

// Resolves a CMP asset URL (the `links.self` from a library-asset field, i.e.
// .../v3/asset-urls/{guid}) to a public CDN image URL + alt text. Returns nulls
// on any failure so the caller can render without an image rather than throwing.
export async function resolveCmpAsset(
  assetUrl: string,
): Promise<{ url: string | null; alt: string }> {
  try {
    const token = await getCmpAccessToken()
    const res = await fetch(assetUrl, {
      headers: { Authorization: `Bearer ${token}` },
      redirect: 'follow',
    })
    if (!res.ok) return { url: null, alt: '' }
    const json = (await res.json()) as { url?: string; alt_text?: string }
    return { url: json.url ?? null, alt: json.alt_text ?? '' }
  } catch {
    return { url: null, alt: '' }
  }
}

// Acknowledge that we can generate the preview. Request shape confirmed against
// the live API: `acknowledgedBy` (a string identifying the generator) is
// required; content_hash is sent too so CMP can tell whether a cached preview is
// stale. We identify ourselves with the CMP app's client id.
export async function acknowledgePreview(
  acknowledgeUrl: string,
  contentHash: string,
): Promise<{ ok: boolean; status: number; body: string }> {
  const token = await getCmpAccessToken()
  const res = await fetch(acknowledgeUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      acknowledgedBy: process.env.CMP_CLIENT_ID ?? 'site-accelerator',
      content_hash: contentHash,
    }),
  })
  const body = await res.text()
  return { ok: res.ok, status: res.status, body }
}

// Complete the preview by handing CMP the URL(s) to embed. Request shape
// confirmed against the live API: `keyedPreviews` maps a label (shown in CMP's
// preview dropdown) → the preview URL as a plain string.
export async function completePreview(
  completeUrl: string,
  keyedPreviews: Record<string, string>,
): Promise<{ ok: boolean; status: number; body: string }> {
  const token = await getCmpAccessToken()
  const res = await fetch(completeUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ keyedPreviews }),
  })
  const body = await res.text()
  return { ok: res.ok, status: res.status, body }
}

// ─── Asset lineage ──────────────────────────────────────────────────────────
//
// Tells CMP where a DAM asset is used on the public site, so an editor looking
// at an asset in the DAM can see which pages depend on it before they archive
// or replace it. One lineage row = one (asset, external URL) pair.
//
//   POST {API_BASE}/assets/{asset_id}/lineages   { name, uri, icon_url?, rendition_id? }
//   → 201 AssetLineageResponse { id, asset_id, version_id, used_in: "external", ... }
//
// `asset_id` is Graph's `cmp_Asset._itemMetadata.key` — verified against the
// live API: GET /v3/asset-urls/{key} returns `id` equal to that same key. So the
// DamImageSource reference the CMS stores in a composition already contains
// everything this call needs (see lib/assetLineage.ts for the walker).
//
// ── What this app's token can and cannot do on /v3/assets ───────────────────
// Verified against the live instance with the client_credentials token that
// CMP_CLIENT_ID/CMP_CLIENT_SECRET mint:
//
//     POST   /v3/assets/{id}/lineages              → 201  ✓ (this function)
//     DELETE /v3/assets/{id}/lineages/{lineageId}  → 204  ✓
//     GET    /v3/assets/{id}                       → 403  ✗
//     GET    /v3/assets/{id}/lineages              → 403  ✗
//     GET    /v3/images/{id}                       → 200  ✓ (asset metadata)
//     GET    /v3/asset-urls/{id}                   → 302  ✓ (resolveCmpAsset)
//
// So writing lineage works on an app token; READING it back does not. The two
// 403s return an AWS-gateway "Invalid key=value pair ... in Authorization
// header" message rather than an Optimizely error, so they read like a
// malformed request — they are not. They are simply not exposed to this app.
// `/v3/images/{id}` is the readable asset resource, and the lineage response's
// own `links.asset` points there rather than at `/v3/assets/{id}`.
//
// The practical consequence, and the reason lib/assetLineage.ts keeps a ledger:
// the API does NOT deduplicate. Posting the same (asset, uri) pair twice yields
// two rows with different ids, so a page republished ten times would accumulate
// ten identical lineage rows, and no GET exists to detect or clean them up.

export type CmpAssetLineageInput = {
  /** Name of the source, shown in CMP. e.g. "Länsförsäkringar Stockholm". */
  name: string
  /** Absolute URL of the page using the asset. Must start with http:// or https://. */
  uri: string
  /** Optional favicon for the source. */
  iconUrl?: string
  /** Optional id of a specific rendition of the asset version. */
  renditionId?: string
}

export type CmpAssetLineageResult =
  | { ok: true; status: number; lineageId?: string; body: unknown }
  | { ok: false; status: number; error: string; body: unknown }

/**
 * What a 403 on the lineage write actually means.
 *
 * The POST is known to work on this app's client_credentials token, so a 403
 * here is a change in access rather than the normal state of things — most
 * likely the CMP app's permissions or the asset's ownership. Worth saying in the
 * log, because the gateway's own message ("Invalid key=value pair ... in
 * Authorization header") points at a malformed request, which it is not.
 */
export function lineageAuthHint(): string {
  return (
    'CMP returned 403 for POST /v3/assets/{id}/lineages. This call normally '
    + 'succeeds on the CMP_CLIENT_ID/CMP_CLIENT_SECRET client_credentials token, '
    + 'so check the CMP app\'s asset permissions and that the asset id belongs to '
    + 'this CMP account. Note the gateway phrases this as an Authorization-header '
    + 'parse error even when the header is well formed — GET /v3/assets/* returns '
    + 'the same message and is simply not exposed to app tokens.'
  )
}

/**
 * Registers one "this asset is used at this URL" row against a DAM asset.
 *
 * Never throws — returns a structured outcome so a caller registering lineage
 * for a dozen assets reports every one and fails none of them. A 403 is logged
 * with `lineageAuthHint()` because that is the expected failure today.
 *
 * @param assetId  CMP asset id (= Graph cmp_Asset._itemMetadata.key)
 */
export async function createAssetLineage(
  assetId: string,
  input: CmpAssetLineageInput,
): Promise<CmpAssetLineageResult> {
  if (!/^https?:\/\//i.test(input.uri)) {
    // The API requires an absolute URL and rejects anything else; catching it
    // here keeps a relative path from being reported as a server-side failure.
    return {
      ok: false,
      status: 0,
      error: `uri must be absolute and start with http:// or https:// (got "${input.uri}")`,
      body: null,
    }
  }

  let token: string
  try {
    token = await getCmpAccessToken()
  } catch (err) {
    return { ok: false, status: 0, error: String(err), body: null }
  }

  let res: Response
  try {
    res = await fetch(`${API_BASE}/assets/${encodeURIComponent(assetId)}/lineages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: input.name,
        uri: input.uri,
        ...(input.iconUrl ? { icon_url: input.iconUrl } : {}),
        ...(input.renditionId ? { rendition_id: input.renditionId } : {}),
      }),
    })
  } catch (err) {
    return { ok: false, status: 0, error: `network error: ${String(err)}`, body: null }
  }

  const text = await res.text()
  let body: unknown = text
  try { body = JSON.parse(text) } catch { /* not JSON — keep raw text */ }

  if (!res.ok) {
    const error = res.status === 403
      ? lineageAuthHint()
      : `CMP lineage create failed: ${res.status} ${text.slice(0, 300)}`
    console.error(`[cmp-lineage] asset=${assetId} uri=${input.uri} → ${res.status}: ${error}`)
    return { ok: false, status: res.status, error, body }
  }

  const lineageId = (body as { id?: string } | null)?.id
  return { ok: true, status: res.status, lineageId, body }
}

/**
 * Removes a lineage row — the counterpart to createAssetLineage.
 *
 * Verified: DELETE /v3/assets/{id}/lineages/{lineageId} → 204. Needed because
 * the API happily creates duplicates and offers no GET to find them, so the id
 * returned at creation time is the only handle you will ever have on a row.
 */
export async function deleteAssetLineage(
  assetId: string,
  lineageId: string,
): Promise<{ ok: boolean; status: number; error?: string }> {
  try {
    const token = await getCmpAccessToken()
    const res = await fetch(
      `${API_BASE}/assets/${encodeURIComponent(assetId)}/lineages/${encodeURIComponent(lineageId)}`,
      { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
    )
    if (!res.ok) {
      return { ok: false, status: res.status, error: (await res.text()).slice(0, 300) }
    }
    return { ok: true, status: res.status }
  } catch (err) {
    return { ok: false, status: 0, error: String(err) }
  }
}

// ─── Requests: templates + work-request creation (Experimental) ────────────

export async function listCmpTemplates(): Promise<{ templates: CmpTemplateSummary[]; raw: unknown }> {
  const token = await getCmpAccessToken()
  const res = await fetch(`${API_BASE}/templates`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(`CMP list templates failed: ${res.status} ${await res.text()}`)
  }
  const raw = await res.json()
  return { templates: normalizeTemplateSummaries(raw), raw }
}

export async function getCmpTemplateDetail(templateId: string): Promise<{ detail: CmpTemplateDetail; raw: unknown }> {
  const token = await getCmpAccessToken()
  const res = await fetch(`${API_BASE}/templates/${encodeURIComponent(templateId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    throw new Error(`CMP get template failed: ${res.status} ${await res.text()}`)
  }
  const raw = await res.json()
  return { detail: normalizeTemplateDetail(raw, templateId), raw }
}

export type CmpWorkRequestFormField = {
  identifier: string
  type:       string
  values:     string[]
}

export type CmpWorkRequestPayload = {
  templateId:  string
  assignees?:  string[]
  formFields:  CmpWorkRequestFormField[]
}

export async function createCmpWorkRequest(
  payload: CmpWorkRequestPayload,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const token = await getCmpAccessToken()
  const res = await fetch(`${API_BASE}/work-requests`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      template_id: payload.templateId,
      assignees:   payload.assignees ?? [],
      form_fields: payload.formFields.map(f => ({
        identifier: f.identifier,
        type:       f.type,
        values:     f.values,
      })),
    }),
  })
  const text = await res.text()
  let body: unknown = text
  try { body = JSON.parse(text) } catch { /* not JSON — keep raw text */ }
  return { ok: res.ok, status: res.status, body }
}
