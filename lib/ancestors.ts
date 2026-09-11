import { cache } from 'react'
import { getClient } from '@/lib/optimizely'

/**
 * Breadcrumb trails built from the CMS content tree, not from the URL string.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 * `buildJsonLd` accepts a `breadcrumbTrail`, and when nobody supplies one it
 * falls back to `deriveBreadcrumbTrail`, which splits the page's URL on "/" and
 * title-cases each segment. That works until it doesn't:
 *
 *   - a segment that is not a real page ("/product/" as a folder, a locale
 *     prefix) still becomes a crumb pointing at a URL that may 404
 *   - the crumb's name is a prettified slug, not the page's actual display name
 *     ("How much can i borrow" instead of "How much can I borrow?")
 *   - rename a page's route segment and every ancestor crumb silently changes
 *
 * Optimizely Graph answers this directly: `getPath` returns the ancestors of a
 * content item, ordered top-most first, each with its real display name and
 * canonical URL. That is the tree the editor actually sees.
 *
 * Failure is not fatal here. A breadcrumb is structured data for crawlers, not
 * page content, so when Graph is unreachable this returns null and the caller
 * falls back to the URL-derived trail rather than rendering a page without SEO.
 */

export type Crumb = { name: string; url?: string }

type PathItem = {
  _metadata?: {
    key?: string
    displayName?: string
    types?: string[]
    url?: { default?: string | null; hierarchical?: string | null }
  }
}

/**
 * Absolute URL for a crumb.
 *
 * Graph returns site-relative paths ("/product/home-insurance/"). Schema.org
 * wants absolute ones, and the origin has to be the canonical site origin
 * rather than the request host so that a preview or a branch deployment does
 * not emit crumbs pointing at itself.
 */
function absolute(origin: string, path?: string | null): string | undefined {
  if (!path) return undefined
  if (/^https?:/i.test(path)) return path
  return `${origin.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * The ancestor trail for one content item, ending with the item itself.
 *
 * @param key      content key (no dashes), from `_metadata.key`
 * @param locale   locale to resolve names and URLs in
 * @param origin   canonical site origin, used to absolutise each crumb
 * @returns the trail, or null when Graph could not answer
 */
export const getBreadcrumbTrail = cache(async (
  key: string,
  locale: string,
  origin: string,
): Promise<Crumb[] | null> => {
  if (!key) return null
  try {
    const items = (await getClient().getPath({ key, locale })) as PathItem[] | null
    if (!items?.length) return null

    const crumbs = items.flatMap((item) => {
      const m = item?._metadata
      const name = m?.displayName?.trim()
      if (!name) return []
      // Folders exist to organise the tree, not to be visited. A crumb for one
      // would point at a URL with nothing behind it.
      if (m?.types?.includes('_Folder')) return []
      return [{ name, url: absolute(origin, m?.url?.default ?? m?.url?.hierarchical) }]
    })

    // A single crumb is just the page itself; buildJsonLd already skips trails
    // shorter than two, and returning one here would suppress the URL-derived
    // fallback for no gain.
    return crumbs.length > 1 ? crumbs : null
  } catch (err) {
    console.warn(`[breadcrumbs] could not resolve ancestors for ${key}:`, err)
    return null
  }
})
