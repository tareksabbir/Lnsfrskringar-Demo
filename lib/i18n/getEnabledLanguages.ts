import { unstable_cache } from 'next/cache'
import { getClient } from '@/lib/optimizely'
import { graphSiteOrigins } from '@/lib/contentScope'
import { SUPPORTED_LOCALES, type Locale } from './config'

const QUERY = `query GetSiteLocales($origins: [String!]) {
  _Page(where: { _metadata: { status: { eq: "Published" } url: { base: { in: $origins } } } }, limit: 0) {
    facets { _metadata { locale(limit: 30) { name count } } }
  }
}`

const fetchLanguages = unstable_cache(async (origins: string[]): Promise<Locale[]> => {
  if (!origins.length) return []
  try {
    const data = await getClient().request(QUERY, { origins })
    const facets: { name: string; count: number }[] = data?._Page?.facets?._metadata?.locale ?? []
    return SUPPORTED_LOCALES.filter(locale => facets.some(f => f.name === locale && f.count > 0))
  } catch (error) {
    console.warn('[languages] Could not load this site’s published locales', error)
    return []
  }
}, ['cms-site-languages'], { tags: ['cms-languages'], revalidate: 3600 })

export function getEnabledLanguages(): Promise<Locale[]> {
  return fetchLanguages(graphSiteOrigins())
}
