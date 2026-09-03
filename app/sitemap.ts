import type { MetadataRoute } from 'next'
import { getClient } from '@/lib/optimizely'

/**
 * XML sitemap, built from what Optimizely Graph has published.
 *
 * Two things about the previous version made it fail invisibly, and both are
 * fixed here — the symptom was a valid but EMPTY <urlset>, which robots.txt
 * still points crawlers at.
 *
 * 1. One query asked for every content type at once. GraphQL is all-or-nothing:
 *    a single unknown field on ONE type fails the whole document, so a problem
 *    with the blog type silently cost us the home page too. Each type is now
 *    queried on its own, and a type that fails is skipped rather than taking
 *    the others with it.
 *
 * 2. The failure was swallowed by a bare `catch { return [] }`. Nothing was
 *    logged, so the only evidence was an empty file nobody looks at. Errors now
 *    name the type and reach the server log (Vercel → Functions).
 *
 * `revalidate` matters more than it looks: without it Next builds this once at
 * deploy time. A Graph hiccup during that one build — a re-index, a timeout —
 * freezes an empty sitemap in place until somebody happens to deploy again.
 * Re-running it hourly means a transient failure costs an hour, not a release.
 */

export const revalidate = 3600

/** Content types that produce a public URL. Add a type by adding a line. */
const PAGE_TYPES = ['BlankExperience', 'OT_BlogPage'] as const

const queryFor = (type: string) => `
  query Sitemap_${type} {
    ${type}(
      where: { _metadata: { status: { eq: "Published" } } }
      limit: 200
    ) {
      items {
        _metadata { url { default } lastModified published }
        noIndex
      }
    }
  }
`

type GraphItem = {
  _metadata?: {
    url?: { default?: string | null } | null
    lastModified?: string | null
    published?: string | null
  } | null
  noIndex?: boolean | null
}

async function itemsFor(type: string): Promise<GraphItem[]> {
  try {
    const data = await getClient().request(queryFor(type), {}) as
      Record<string, { items?: GraphItem[] } | undefined>
    return data?.[type]?.items ?? []
  } catch (err) {
    // Log and carry on. A broken type must not empty the whole sitemap.
    console.error(`[sitemap] ${type} query failed:`, err)
    return []
  }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? ''
  if (!siteUrl) {
    console.error('[sitemap] NEXT_PUBLIC_SITE_URL is not set — emitting an empty sitemap.')
    return []
  }

  const results = await Promise.all(PAGE_TYPES.map(itemsFor))
  const allItems = results.flat()

  if (allItems.length === 0) {
    console.error(
      `[sitemap] Graph returned no published pages for ${PAGE_TYPES.join(', ')}. `
      + 'If this is unexpected, check the errors above.',
    )
  }

  const seen = new Set<string>()
  const entries: MetadataRoute.Sitemap = []

  for (const item of allItems) {
    if (item.noIndex) continue

    const raw = item._metadata?.url?.default
    if (!raw) continue

    // Graph may hand back an absolute URL or a site-relative path.
    let fullUrl: string
    try {
      fullUrl = raw.startsWith('http') ? raw : `${siteUrl}${raw}`
      new URL(fullUrl)
    } catch {
      continue
    }

    if (seen.has(fullUrl)) continue
    seen.add(fullUrl)

    const rawDate = item._metadata?.lastModified ?? item._metadata?.published
    const parsedDate = rawDate ? new Date(rawDate) : undefined
    const lastModified =
      parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : undefined

    const isHome = new URL(fullUrl).pathname === '/'

    entries.push({
      url: fullUrl,
      lastModified,
      changeFrequency: isHome ? 'daily' : 'weekly',
      priority: isHome ? 1.0 : 0.8,
    })
  }

  return entries
}
