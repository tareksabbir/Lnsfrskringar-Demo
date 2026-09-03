import { cache } from 'react'
import { getClient, getRequestLocale } from '@/lib/optimizely'

/**
 * Listing data for /blog.
 *
 * Deliberately NOT lib/blogFeed.ts. That one queries OT_BlogPage, and the
 * articles this site actually publishes — the ones the Opal tool and
 * lib/blogComposition.ts create — are BlankExperience documents, because they
 * are composition pages that must stay editable in Visual Builder. A feed
 * pointed at OT_BlogPage renders an empty list against this content, which is
 * exactly what would have happened had we dropped OT_BlogFeedBlock onto a page.
 *
 * ── On the shape of the query ────────────────────────────────────────────────
 * Every field below is copied from buildBlankExperienceQuery in
 * app/api/search/route.ts, which is exercised by the site search and therefore
 * known to survive Graph. Nothing speculative is asked for:
 *
 *   - No `noIndex`. It is declared on the content type, but app/sitemap.ts asks
 *     for it and returns an empty sitemap in production, so it is a prime
 *     suspect for a field the CMS knows and Graph has not indexed. One unknown
 *     field fails the WHOLE document, and an empty blog index is not worth that
 *     risk. Draft/unpublished pages are excluded by Graph already.
 *   - No `orderBy` and no `url { hierarchical }`. Both appear elsewhere in this
 *     repo in code paths that swallow their own errors, so neither is actually
 *     proven. Sorting and path filtering happen in JS below, where they cannot
 *     fail.
 *   - No site scoping on `url.base`. The search route builds that filter as
 *     `https://${domain}` from the ThemeManager, while getRequestBaseUrl()
 *     returns the request's own scheme — http on localhost. Mismatch there
 *     yields zero rows and no error, which is precisely how /sitemap.xml came
 *     to serve an empty urlset. This instance hosts one site, and the
 *     `/blog/` path filter below already scopes the result, so the domain
 *     clause bought nothing and could silently cost everything.
 *
 * Loosen this once someone can run the query against Graph and watch it work.
 */

const BLOG_INDEX_QUERY = `
  query GetBlogIndex($locale: String!, $limit: Int!) {
    BlankExperience(
      where: { _metadata: { locale: { eq: $locale } } }
      limit: $limit
    ) {
      items {
        _metadata { key published displayName url { default base } }
        seoDescription
        ogImage { url { default } }
      }
    }
  }
`

export type BlogIndexPost = {
  key:          string
  title:        string
  description:  string | null
  path:         string
  published:    string | null
  imageUrl:     string | null
}

/**
 * `null` means the lookup FAILED; an empty array means it succeeded and there
 * is nothing to show. The page renders different words for each, because "no
 * articles yet" and "the CMS did not answer" are not the same thing to whoever
 * is looking at the screen.
 */
export type BlogIndexResult = BlogIndexPost[] | null

/** Articles live under this prefix. The index page itself is excluded. */
const BLOG_PREFIX = '/blog/'

function pathOf(raw: unknown): string | null {
  if (typeof raw !== 'string' || !raw) return null
  try {
    return raw.startsWith('http') ? new URL(raw).pathname : raw
  } catch {
    return null
  }
}

export const getBlogIndex = cache(async function getBlogIndex(): Promise<BlogIndexResult> {
  const locale = await getRequestLocale()

  let items: unknown[]
  try {
    const data = await getClient().request(BLOG_INDEX_QUERY, {
      locale,
      limit: 100,
    }) as { BlankExperience?: { items?: unknown[] } }
    items = data?.BlankExperience?.items ?? []
  } catch (err) {
    console.error('[blog-index] Graph query failed:', err)
    return null
  }

  const seen = new Set<string>()
  const posts: BlogIndexPost[] = []

  for (const raw of items) {
    const item = raw as {
      _metadata?: {
        key?: string
        published?: string | null
        displayName?: string | null
        url?: { default?: string | null } | null
      } | null
      seoDescription?: string | null
      ogImage?: { url?: { default?: string | null } | null } | null
    }

    const path = pathOf(item._metadata?.url?.default)
    // Under /blog/, but not the index itself and not a deeper sub-folder page.
    if (!path || !path.startsWith(BLOG_PREFIX)) continue

    const key = item._metadata?.key
    if (!key || seen.has(key)) continue
    seen.add(key)

    posts.push({
      key,
      title:       item._metadata?.displayName?.trim() || 'Untitled article',
      description: item.seoDescription?.trim() || null,
      path,
      published:   item._metadata?.published ?? null,
      imageUrl:    item.ogImage?.url?.default ?? null,
    })
  }

  // Newest first. Anything without a date sorts last rather than to the top —
  // a missing timestamp is not a claim to be the most recent post.
  posts.sort((a, b) => {
    const ta = a.published ? Date.parse(a.published) : NaN
    const tb = b.published ? Date.parse(b.published) : NaN
    if (Number.isNaN(ta) && Number.isNaN(tb)) return a.title.localeCompare(b.title)
    if (Number.isNaN(ta)) return 1
    if (Number.isNaN(tb)) return -1
    return tb - ta
  })

  return posts
})
