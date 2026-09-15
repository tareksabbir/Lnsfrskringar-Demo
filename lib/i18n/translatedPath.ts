import { getClient } from '@/lib/optimizely'
import { belongsToSite, graphSiteOrigins } from '@/lib/contentScope'
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, localizedHref, type Locale } from './config'

type Item = { _metadata?: { key?: string; url?: { default?: string; base?: string } } }
const QUERY = `query ResolveLanguagePath($where: _ContentWhereInput) {
  _Content(where: $where, limit: 2) { items { _metadata { key url { default base } } } }
}`

export async function translatedPath(path: string, from: Locale, to: Locale): Promise<string | null> {
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('\\')) return null
  const clean = new URL(path, 'https://local.invalid').pathname
  const unprefixed = clean.replace(new RegExp(`^/(${SUPPORTED_LOCALES.join('|')})(?=/|$)`), '') || '/'
  const variants = [...new Set([clean, unprefixed, `/${from}${unprefixed}`])]
    .flatMap(p => [p.replace(/\/$/, '') || '/', p.replace(/\/$/, '') + '/'])
  const origins = graphSiteOrigins()
  if (!origins.length) return null
  const source = await getClient().request(QUERY, { where: { _metadata: {
    locale: { eq: from }, status: { eq: 'Published' },
    url: { base: { in: origins } },
  }, _or: variants.flatMap(p => [
    { _metadata: { url: { default: { eq: p } } } },
    { _metadata: { url: { hierarchical: { eq: p } } } },
  ]) } }) as { _Content?: { items?: Item[] } }
  const items = source._Content?.items ?? []
  const key = items.length === 1 ? items[0]._metadata?.key : null
  if (!key) {
    // These are code-owned pages, not translated CMS documents.
    if (!items.length && (unprefixed === '/blog' || unprefixed === '/showcase' || unprefixed.startsWith('/showcase/'))) {
      return localizedHref(unprefixed, to)
    }
    return null
  }
  const target = await getClient().request(QUERY, { where: { _metadata: {
    key: { eq: key }, locale: { eq: to }, status: { eq: 'Published' }, url: { base: { in: origins } },
  } } }) as { _Content?: { items?: Item[] } }
  const meta = target._Content?.items?.[0]?._metadata
  if (!meta?.url?.default || !belongsToSite(meta.url.base)) return null
  const url = new URL(meta.url.default, meta.url.base)
  if (!belongsToSite(url.origin)) return null
  // Preserve the CMS-translated slug. Only normalize the default locale prefix.
  return to === DEFAULT_LOCALE
    ? url.pathname.replace(new RegExp(`^/${DEFAULT_LOCALE}(?=/|$)`), '') || '/'
    : url.pathname
}
