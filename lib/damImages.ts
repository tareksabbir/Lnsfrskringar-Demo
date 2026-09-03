import { getClient } from '@/lib/optimizely'

/**
 * Reads the DAM (Optimizely CMP) image library through Graph.
 *
 * ── The reference format, which is the whole point of this file ─────────────
 * A DAM asset is NOT referenced like ordinary CMS media. Reading the published
 * home page's composition shows the shape the CMS actually stores:
 *
 *     cms://content/DamImageSource/2f4c455aa50b11f1916b4a7836a56b60
 *
 * The trailing id is cmp_Asset._itemMetadata.key — exactly what this module
 * returns. An earlier version of the blog builder wrote
 * "cms://content/<key>" without the DamImageSource segment, which would have
 * silently produced an image block with no image.
 *
 * ── Why this is a listing and not really a search ───────────────────────────
 * Graph indexes cmp_Asset with _fulltext, so searching is possible. It is also
 * close to useless here: the library holds a dozen assets whose titles are
 * Unsplash filenames like "charles-forerunner-3fPXt37X6UQ-unsplash.jpg". A
 * query for "house" matches nothing, not because the image is absent but
 * because nothing describes it. So `query` narrows by title when given and the
 * default is to return everything, which for a library this size is the more
 * useful answer. Give the assets real titles or tags in CMP and the filter
 * starts earning its name.
 */

/** Assets are fetched in two steps: cmp_Asset has no URL field of its own. */
const ASSETS_QUERY = `
  query ListDamAssets($limit: Int!) {
    cmp_Asset(limit: $limit, orderBy: { Title: ASC }) {
      items {
        _itemMetadata { key }
        Title
        MimeType
      }
    }
  }
`

/** The CDN URL lives only on _AssetItem._assetMetadata. */
const ASSET_URLS_QUERY = `
  query GetDamAssetUrls($keys: [String]) {
    _AssetItem(where: { _itemMetadata: { key: { in: $keys } } }, limit: 100) {
      items {
        _itemMetadata { key }
        _assetMetadata { url }
      }
    }
  }
`

export type DamImage = {
  /** Pass this to create_blog_article as `imageKey`. */
  key:      string
  title:    string
  mimeType: string
  /** Public CDN URL, for a person to eyeball before choosing. */
  url:      string | null
}

/** Graph rejects limit > 100 outright — it does not clamp. */
const GRAPH_MAX_LIMIT = 100

function isImage(mime: unknown): boolean {
  return typeof mime === 'string' && mime.startsWith('image/')
}

/** Drop the file extension so a title reads like a name, not a filename. */
function tidyTitle(raw: unknown): string {
  const s = typeof raw === 'string' ? raw.trim() : ''
  if (!s) return 'Untitled'
  const dot = s.lastIndexOf('.')
  return dot > 0 ? s.slice(0, dot) : s
}

/**
 * @param query  optional case-insensitive substring match on the title
 * @param limit  how many to return, 1–50
 * @returns      images, or null if Graph could not be reached
 */
export async function listDamImages(
  query?: string | null,
  limit = 25,
): Promise<DamImage[] | null> {
  const want = Math.min(Math.max(1, limit), 50)

  let assets: Array<{ _itemMetadata?: { key?: string }; Title?: string; MimeType?: string }>
  try {
    const data = await getClient().request(ASSETS_QUERY, { limit: GRAPH_MAX_LIMIT }) as
      { cmp_Asset?: { items?: typeof assets } }
    assets = data?.cmp_Asset?.items ?? []
  } catch (err) {
    console.error('[dam-images] cmp_Asset query failed:', err)
    return null
  }

  const needle = query?.trim().toLowerCase()
  const matched = assets
    .filter(a => isImage(a.MimeType) && a._itemMetadata?.key)
    .filter(a => !needle || tidyTitle(a.Title).toLowerCase().includes(needle))
    .slice(0, want)

  if (matched.length === 0) return []

  // URLs are a convenience, not the answer. If this second query fails the
  // keys are still usable, so return the assets with url: null rather than
  // failing the whole call.
  const urlByKey = new Map<string, string>()
  try {
    const keys = matched.map(a => a._itemMetadata!.key!)
    const data = await getClient().request(ASSET_URLS_QUERY, { keys }) as
      { _AssetItem?: { items?: Array<{ _itemMetadata?: { key?: string }; _assetMetadata?: { url?: string } }> } }
    for (const item of data?._AssetItem?.items ?? []) {
      const k = item._itemMetadata?.key
      const u = item._assetMetadata?.url
      if (k && u) urlByKey.set(k, u)
    }
  } catch (err) {
    console.warn('[dam-images] asset URL lookup failed; returning keys without previews:', err)
  }

  return matched.map(a => ({
    key:      a._itemMetadata!.key!,
    title:    tidyTitle(a.Title),
    mimeType: a.MimeType ?? 'image/*',
    url:      urlByKey.get(a._itemMetadata!.key!) ?? null,
  }))
}

/** The reference string the CMS stores for a DAM asset. */
export function damContentReference(key: string): string {
  return `cms://content/DamImageSource/${key}`
}
