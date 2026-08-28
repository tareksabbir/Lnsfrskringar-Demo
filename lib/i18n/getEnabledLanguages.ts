/**
 * getEnabledLanguages — returns the list of locales that should appear in the
 * site language selector, derived from Optimizely Graph.
 *
 * Source of truth: Content Graph locale facets on _Content.
 * A locale is shown when it has at least one piece of published content indexed
 * in Graph AND it is a routing-supported locale (SUPPORTED_LOCALES).
 *
 * Why _Content facets instead of SiteDefinition?
 * This Graph instance does not expose a SiteDefinition query type. The facets
 * approach achieves the same editorial intent: editors enable a new language in
 * CMS Settings, publish content in that language, and it automatically appears
 * in the selector on the next cache revalidation — zero code change required
 * (assuming the locale is also added to SUPPORTED_LOCALES for routing support).
 *
 * Normalization: CMS locale codes can be BCP-47 subtags (e.g. "es-MX") while
 * the app uses two-letter codes ("es"). We normalise to the base language tag
 * and check against SUPPORTED_LOCALES before including.
 *
 * Cache: 1-hour ISR via unstable_cache. Revalidate tag 'cms-languages' can be
 * targeted by an on-demand revalidation webhook when a new locale is activated.
 */

import { unstable_cache } from 'next/cache'
import { getClient } from '@/lib/optimizely'
import { SUPPORTED_LOCALES, isSupportedLocale, DEFAULT_LOCALE } from '@/lib/i18n/config'
import type { Locale } from '@/lib/i18n/config'

const LOCALE_FACETS_QUERY = `
  query GetIndexedLocales {
    _Content(limit: 0) {
      facets {
        _metadata {
          locale(limit: 30) {
            name
            count
          }
        }
      }
    }
  }
`

/**
 * Normalises a CMS BCP-47 locale code to an app locale code.
 * "es-MX" → "es"  |  "fr-FR" → "fr"  |  "en" → "en"
 */
function normalizeToCmsAppLocale(cmsLocale: string): string {
  const lower = cmsLocale.toLowerCase().trim()
  if (!lower) return ''
  if (isSupportedLocale(lower)) return lower
  const base = lower.slice(0, 2)
  if (isSupportedLocale(base)) return base
  return lower // passthrough for unknown codes
}

async function fetchEnabledLanguages(): Promise<Locale[]> {
  try {
    const data = await getClient().request(LOCALE_FACETS_QUERY, {})
    const facets: { name: string; count: number }[] =
      data?._Content?.facets?._metadata?.locale ?? []

    if (!facets.length) {
      console.warn('[getEnabledLanguages] No locale facets returned from Graph — using all SUPPORTED_LOCALES')
      return [...SUPPORTED_LOCALES]
    }

    // Normalise, deduplicate, and filter to routing-supported locales.
    const seen = new Set<string>()
    const enabled: Locale[] = []

    for (const { name } of facets) {
      if (!name) continue
      const normalized = normalizeToCmsAppLocale(name)
      if (!normalized || seen.has(normalized)) continue
      seen.add(normalized)
      if (isSupportedLocale(normalized)) enabled.push(normalized as Locale)
    }

    if (!enabled.length) {
      console.warn('[getEnabledLanguages] Intersection of Graph locales and SUPPORTED_LOCALES is empty — using all SUPPORTED_LOCALES')
      return [...SUPPORTED_LOCALES]
    }

    // Default locale always first, then others in discovery order.
    return [
      ...enabled.filter(l => l === DEFAULT_LOCALE),
      ...enabled.filter(l => l !== DEFAULT_LOCALE),
    ]
  } catch (err) {
    console.warn('[getEnabledLanguages] Graph query failed — using all SUPPORTED_LOCALES:', err)
    return [...SUPPORTED_LOCALES]
  }
}

/**
 * Returns the locale codes to display in the language selector.
 * Cached for 1 hour; revalidate with tag 'cms-languages'.
 */
export const getEnabledLanguages = unstable_cache(
  fetchEnabledLanguages,
  ['cms-enabled-languages'],
  { tags: ['cms-languages'], revalidate: 3600 },
)
