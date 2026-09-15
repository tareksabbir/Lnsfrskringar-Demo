import { belongsToSite } from '@/lib/contentScope'
import type { MetadataRoute } from 'next'
import { getClient } from '@/lib/optimizely'
import { DEFAULT_LOCALE } from '@/lib/i18n/config'

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
const PAGE_TYPES = ['BlankExperience', 'OT_BlogPage', 'OT_CampaignPage', 'OT_EventPage', 'OT_TopicHubPage', 'OT_PractitionerPage'] as const

/**
 * Graph's hard ceiling. Asking for more is not clamped — it is a 400:
 *
 *   Invalid 'limit' (value: 200, expected: [0-100])
 *
 * This is what emptied the sitemap. The old query asked for 200, the whole
 * document failed, and a bare `catch { return [] }` turned a loud API error
 * into a silent empty file that robots.txt still pointed crawlers at.
 *
 * Each type is paged using skip until all published items have been read.
 */
const GRAPH_MAX_LIMIT = 100

const queryFor = (type: string) => `
  query Sitemap_${type}($skip: Int!) {
    ${type}(
      where: { _metadata: { status: { eq: "Published" } } }
      limit: ${GRAPH_MAX_LIMIT}
      skip: $skip
      orderBy: { _metadata: { key: ASC } }
    ) {
      items {
        _metadata { url { default base } lastModified published }
        noIndex
      }
    }
  }
`

/**
 * Rewrite a Graph URL into the one this site actually serves.
 *
 * Graph returns the default locale as a path segment — "/en/blog/x/" — but
 * i18n/config is explicit that the default locale carries NO prefix, and every
 * link on the site points at "/blog/x". Both forms render, and each declares
 * ITSELF canonical, so shipping the prefixed form in the sitemap hands search
 * engines two URLs for one page and splits the ranking signal between them.
 * Non-default locales keep their prefix — there the prefix is the real URL.
 *
 * The trailing slash goes for the same reason: the page at "/blog/x" says its
 * canonical is "/blog/x", with no slash.
 */
function toSiteUrl(raw: string): string {
  const url = new URL(raw)
  const segments = url.pathname.split('/').filter(Boolean)

  if (segments[0] === DEFAULT_LOCALE) segments.shift()

  // The home page keeps its slash — "https://host/" is the form everything else
  // on the site uses for the root, and a bare origin invites a needless redirect.
  if (segments.length === 0) return `${url.origin}/`

  url.pathname = `/${segments.join('/')}`
  return url.toString().replace(/\/$/, '')
}

type GraphItem = {
  _metadata?: {
    url?: { default?: string | null; base?: string | null } | null
    lastModified?: string | null
    published?: string | null
  } | null
  noIndex?: boolean | null
}

async function itemsFor(type: string): Promise<GraphItem[]> {
  try {
    const items: GraphItem[] = []
    for (let skip = 0; ; skip += GRAPH_MAX_LIMIT) {
      const data = await getClient().request(queryFor(type), { skip }) as
        Record<string, { items?: GraphItem[] } | undefined>
      const batch = data?.[type]?.items ?? []
      items.push(...batch)
      if (batch.length < GRAPH_MAX_LIMIT) break
    }
    return items
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
    if (item.noIndex || !belongsToSite(item._metadata?.url?.base, siteUrl)) continue

    const raw = item._metadata?.url?.default
    if (!raw) continue

    // Graph may hand back an absolute URL or a site-relative path.
    let fullUrl: string
    try {
      const resolved = new URL(raw, siteUrl)
      if (!['http:', 'https:'].includes(resolved.protocol)) continue
      if (!belongsToSite(resolved.origin, siteUrl) && resolved.origin !== new URL(siteUrl).origin) continue
      fullUrl = toSiteUrl(new URL(resolved.pathname, siteUrl).toString())
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
