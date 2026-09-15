import { cache } from 'react'
import { getClient, getRequestLocale } from '@/lib/optimizely'
import { belongsToSite, blogContainerKey } from '@/lib/contentScope'

// BlankExperience articles are identified by their ancestor key, not by an
// editable URL segment. Renaming or nesting the Blog folder keeps its identity.
const BLOG_INDEX_QUERY = `
  query GetBlogIndex($locale: String!, $limit: Int!, $skip: Int!) {
    BlankExperience(
      where: { _metadata: { locale: { eq: $locale } status: { eq: "Published" } } }
      limit: $limit
      skip: $skip
      orderBy: { _metadata: { key: ASC } }
    ) {
      items {
        _metadata { key path container published displayName url { default base } }
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

type BlogItem = {
  _metadata?: {
    key?: string
    path?: string[]
    container?: string
    published?: string | null
    displayName?: string | null
    url?: { default?: string | null; base?: string | null }
  }
  seoDescription?: string | null
  ogImage?: { url?: { default?: string | null } }
}

const normalizeKey = (key: string) => key.replace(/-/g, '').toLowerCase()

export const getBlogIndex = cache(async function getBlogIndex(): Promise<BlogIndexResult> {
  const locale = await getRequestLocale()
  const root = normalizeKey(blogContainerKey())
  const items: BlogItem[] = []
  try {
    for (let skip = 0; ; skip += 100) {
      const data = await getClient().request(BLOG_INDEX_QUERY, { locale, limit: 100, skip }) as
        { BlankExperience?: { items?: BlogItem[] } }
      const batch = data?.BlankExperience?.items ?? []
      items.push(...batch)
      if (batch.length < 100) break
    }
  } catch (err) {
    console.error('[blog-index] Graph query failed:', err)
    return null
  }

  const seen = new Set<string>()
  const posts: BlogIndexPost[] = []
  for (const item of items) {
    const meta = item._metadata
    const key = meta?.key
    if (!key || normalizeKey(key) === root || seen.has(key)) continue
    const ancestors = [...(meta?.path ?? []), meta?.container ?? '']
    if (!ancestors.some(key => normalizeKey(key) === root)) continue
    if (!belongsToSite(meta?.url?.base)) continue
    const raw = meta?.url?.default
    if (!raw) continue
    let path: string
    try {
      const url = new URL(raw, meta?.url?.base ?? undefined)
      if (!['http:', 'https:'].includes(url.protocol) || !belongsToSite(url.origin)) continue
      path = url.pathname
    } catch { continue }
    seen.add(key)
    posts.push({
      key,
      title: meta?.displayName?.trim() || 'Untitled article',
      description: item.seoDescription ?? null,
      path,
      published: meta?.published ?? null,
      imageUrl: item.ogImage?.url?.default ?? null,
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
