/**
 * CMS-managed URL redirects (`UIExtensionRedirect`).
 *
 * The Optimizely Workbench extension creates one `UIExtensionRedirect` content
 * item per rule, in a "UI Extension Redirects" folder. Nothing in the CMS acts
 * on them — they are inert data until a front end reads them, which is what this
 * module does for `proxy.ts`.
 *
 * Runs inside the proxy, so:
 *   - no `@optimizely/cms-sdk` (server-only) and no `unstable_cache` (not
 *     available in the proxy/middleware runtime) — a plain `fetch` to Graph plus
 *     a module-scope TTL cache, which lives as long as the isolate does;
 *   - a fetch failure never blocks the request: stale rules are reused, and an
 *     empty table simply means "no redirect".
 *
 * Both LF sites share one CMS instance, and the content type carries no site or
 * host field, so **every rule applies to both sites**. Scope by writing
 * site-specific paths, or by giving each site its own instance.
 */

import { isSupportedLocale } from '@/lib/i18n/config'

const GRAPH_URL = process.env.OPTIMIZELY_GRAPH_URL ?? 'https://cg.optimizely.com/content/v2'
const TTL_MS    = Number(process.env.REDIRECTS_TTL_MS ?? 60_000)
const VALID_STATUS = new Set([301, 302, 307, 308])

// Graph rejects a `limit` above 100 outright (INVALID_ARG_ERROR → HTTP 400), so
// the table is paged. PAGE_LIMIT * MAX_PAGES is the ceiling on rules honoured.
const QUERY = `
  query GetRedirects($limit: Int!, $skip: Int!) {
    UIExtensionRedirect(limit: $limit, skip: $skip) {
      total
      items { fromPath toUrl statusCode enabled }
    }
  }
`
const PAGE_LIMIT = 100
const MAX_PAGES  = 10

/** How far /a → /b → /c is followed before the chain is treated as a loop. */
const MAX_CHAIN_HOPS = 5

type RedirectRule = { to: string; status: number }

type Cached = { table: Map<string, RedirectRule>; expires: number }

let cached: Cached | null = null
let inFlight: Promise<Map<string, RedirectRule>> | null = null
let warned = false

/**
 * Trailing slashes and case are the two things editors get wrong most often, so
 * both sides of the comparison are normalised rather than trusted.
 */
function normalizePath(raw: string): string {
  let p = raw.trim()
  if (!p) return '/'
  // Tolerate a full URL in `fromPath` — only its path participates in matching.
  if (/^https?:\/\//i.test(p)) {
    try { p = new URL(p).pathname } catch { /* keep the raw string */ }
  }
  if (!p.startsWith('/')) p = `/${p}`
  p = p.split('?')[0].split('#')[0]
  if (p.length > 1) p = p.replace(/\/+$/, '') || '/'
  return p.toLowerCase()
}

function parseStatus(raw: unknown): number {
  const n = Number(String(raw ?? '').trim())
  return VALID_STATUS.has(n) ? n : 302
}

async function fetchTable(): Promise<Map<string, RedirectRule>> {
  const key = process.env.OPTIMIZELY_GRAPH_SINGLE_KEY
  const table = new Map<string, RedirectRule>()
  if (!key) return table

  for (let page = 0; page < MAX_PAGES; page++) {
    const res = await fetch(`${GRAPH_URL}?auth=${key}`, {
      method:  'POST',
      headers: { 'content-type': 'application/json' },
      body:    JSON.stringify({ query: QUERY, variables: { limit: PAGE_LIMIT, skip: page * PAGE_LIMIT } }),
      // The proxy runtime has no data cache; freshness is the TTL cache below.
      cache:   'no-store',
      signal:  AbortSignal.timeout(4000),
    })
    if (!res.ok) throw new Error(`Graph returned ${res.status}`)

    const json = await res.json()
    // Graph answers 200 with an `errors` array for a valid-but-rejected query,
    // and `data` null — treat that as a failure so stale rules stay in play.
    if (json?.errors?.length) {
      throw new Error(json.errors.map((e: { message?: string }) => e.message).join('; '))
    }

    const items: unknown[] = json?.data?.UIExtensionRedirect?.items ?? []
    for (const raw of items) {
      const item = raw as Record<string, unknown>
      // `enabled` is a string field on the content type; only an explicit
      // "false" switches a published rule off.
      if (String(item?.enabled ?? '').trim().toLowerCase() === 'false') continue
      const from = normalizePath(String(item?.fromPath ?? ''))
      const to   = String(item?.toUrl ?? '').trim()
      if (!from || !to || from === '/') continue   // never redirect the home page away
      if (!table.has(from)) table.set(from, { to, status: parseStatus(item?.statusCode) })
    }

    if (items.length < PAGE_LIMIT) break
  }
  return table
}

async function getTable(): Promise<Map<string, RedirectRule>> {
  const now = Date.now()
  if (cached && cached.expires > now) return cached.table
  if (inFlight) return inFlight

  inFlight = fetchTable()
    .then(table => {
      cached = { table, expires: Date.now() + TTL_MS }
      warned  = false
      return table
    })
    .catch(err => {
      if (!warned) {
        warned = true
        console.error('[redirects] could not load rules from Graph:', err)
      }
      // Serve the previous table rather than dropping every rule on one blip.
      if (cached) {
        cached.expires = Date.now() + 10_000
        return cached.table
      }
      return new Map<string, RedirectRule>()
    })
    .finally(() => { inFlight = null })

  return inFlight
}

/** Appends the incoming query string unless the destination brings its own. */
function withSearch(location: string, search: string): string {
  if (!search || location.includes('?')) return location
  return location + search
}

/**
 * The locale prefix to put in front of a destination, or '' when it needs none:
 * an absolute URL, or a destination the editor already wrote with a locale
 * prefix of its own (`/sv/spara`), keeps the path it was given.
 */
function prefixFor(to: string, localePrefix: string): string {
  if (!localePrefix) return ''
  if (/^https?:\/\//i.test(to)) return ''
  const firstSegment = to.replace(/^\//, '').split('/')[0]
  if (isSupportedLocale(firstSegment)) return ''
  return to.startsWith('/') ? localePrefix : `${localePrefix}/`
}

/**
 * Follows /a → /b → /c to its end so the browser makes one hop instead of
 * three, and gives up on a cycle (/a → /b → /a) instead of handing the browser
 * a loop. Only relative destinations are followed; an absolute URL is the end
 * of the chain by definition.
 */
function followChain(table: Map<string, RedirectRule>, start: string, from: string): string {
  let location = start
  const seen = new Set([normalizePath(from)])
  for (let hop = 0; hop < MAX_CHAIN_HOPS; hop++) {
    if (/^https?:\/\//i.test(location)) return location
    const path = normalizePath(location)
    if (seen.has(path)) return ''      // cycle — caller drops the redirect
    seen.add(path)
    const next = table.get(path)
    if (!next) return location
    location = next.to
  }
  return ''                            // chain too long to trust
}

export type ResolvedRedirect = { location: string; status: number }

/**
 * Returns the redirect for a request, or null when no rule matches.
 *
 * A rule written as `/old` also fires for the locale-prefixed `/sv/old`, and a
 * relative destination keeps that prefix (`/sv/old` → `/sv/new`) so a redirect
 * never silently drops the visitor's language.
 */
export async function resolveRedirect(opts: {
  /** Path as requested, e.g. `/sv/old-page`. */
  pathname: string
  /** Locale-stripped path the app router sees, e.g. `/old-page`. */
  internalPath: string
  /** The stripped prefix, e.g. `/sv`, or '' when there was none. */
  localePrefix: string
  /** Original query string including `?`, or ''. */
  search: string
}): Promise<ResolvedRedirect | null> {
  const { pathname, internalPath, localePrefix, search } = opts
  const table = await getTable()
  if (!table.size) return null

  // An exact match on the requested path wins: the editor wrote that path.
  const direct = table.get(normalizePath(pathname))
  if (direct) return finalize({ table, rule: direct, source: pathname, pathname, localePrefix: '', search })

  if (internalPath === pathname) return null

  const viaLocale = table.get(normalizePath(internalPath))
  if (!viaLocale) return null

  // Chain-follow on the locale-less path (that is how rules are written), then
  // put the prefix back on whatever the chain ends at.
  return finalize({ table, rule: viaLocale, source: internalPath, pathname, localePrefix, search })
}

function finalize(opts: {
  table: Map<string, RedirectRule>
  rule: RedirectRule
  /** Path the rule was matched on — the chain's starting point. */
  source: string
  /** Path as requested, used for the self-redirect check. */
  pathname: string
  localePrefix: string
  search: string
}): ResolvedRedirect | null {
  const { table, rule, source, pathname, localePrefix, search } = opts
  const end = followChain(table, rule.to, source)
  if (!end) return null
  const location = withSearch(`${prefixFor(end, localePrefix)}${end}`, search)
  // A rule pointing at its own source is a no-op, not a loop to pass on.
  return normalizePath(location) === normalizePath(pathname) ? null : { location, status: rule.status }
}
