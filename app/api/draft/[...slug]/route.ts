import { draftMode } from 'next/headers'
import { redirect } from 'next/navigation'
import { getClient } from '@/lib/optimizely'

// Lightweight query — only the fields needed to type-route and build the redirect URL.
const GET_CONTENT_BY_KEY_AND_VERSION = `
  query GetContentByKeyAndVersion($where: _ContentWhereInput, $variation: VariationInput) {
    _Content(where: $where, variation: $variation) {
      item {
        __typename
        _metadata {
          types
          url {
            default
            hierarchical
          }
        }
      }
    }
  }
`

function toPath(raw: string | null | undefined): string | null {
  if (!raw) return null
  try {
    // Handle both relative paths ('/en/home/') and absolute URLs
    return raw.startsWith('http') ? new URL(raw).pathname : raw
  } catch {
    return null
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)

  const preview_token = searchParams.get('preview_token')
  const key           = searchParams.get('key')
  const ver           = searchParams.get('ver')
  const loc           = searchParams.get('loc')

  if (!preview_token || !key || !ver || !loc) {
    return new Response('Not Found', { status: 404 })
  }

  // `variation: ALL` is required, not optional: Graph excludes every row with a
  // non-null `variation` unless a query opts in, and a content variation is just
  // another version of this same key. Without it, switching to a variation in
  // Visual Builder 404s here and the editor falls back to the original.
  const variables = {
    where: {
      _metadata: {
        key:     { eq: key },
        version: { eq: ver },
        locale:  { eq: loc },
      },
    },
    variation: { include: 'ALL' },
  }

  // Content Graph lags a few seconds behind a CMS write, and the version this
  // route is asked to resolve is always the freshest thing in the system — a
  // just-created variation or a just-saved draft. A single attempt turns that
  // ordinary lag into a 404, and the editor reads a 404 as "this version does
  // not exist" and returns to the original. The page routes already retry; they
  // never get the chance, because this redirect is what sends the browser there.
  const RETRY_DELAYS_MS = [0, 500, 1200, 2500]

  let item: any = null
  for (const delay of RETRY_DELAYS_MS) {
    if (delay) await new Promise(r => setTimeout(r, delay))
    try {
      const data = await getClient().request(
        GET_CONTENT_BY_KEY_AND_VERSION,
        variables,
        preview_token,
        false, // never cache preview requests
      )
      item = data?._Content?.item
      if (item) break
    } catch (err) {
      // Logged, not swallowed: a Graph error and "not indexed yet" produce the
      // same 404 downstream, and only one of them is worth waiting out.
      console.error(`[draft] Graph lookup failed for key=${key} ver=${ver} loc=${loc}:`, err)
    }
  }

  if (!item) {
    console.warn(
      `[draft] no content for key=${key} ver=${ver} loc=${loc} after `
      + `${RETRY_DELAYS_MS.length} attempts — returning 404`,
    )
    return new Response('Not Found', { status: 404 })
  }

  const types: string[] = item._metadata?.types ?? []

  ;(await draftMode()).enable()

  // Passed through to the target page so it can call getPreviewContent
  const qs = new URLSearchParams({ preview_token, key, ver, loc })

  if (types.includes('_Experience')) {
    const path = toPath(item._metadata?.url?.default)
    if (!path) return new Response('Not Found', { status: 404 })
    redirect(`${path}?${qs}`)
  }

  // _Component covers both shared blocks and contentassets-backed blocks.
  // Route to the unified /preview page so it handles the same way as experiences.
  if (types.includes('_Component')) {
    const blockQs = new URLSearchParams({ preview_token: preview_token!, key: key!, ver: ver!, loc: loc!, ctx: 'edit' })
    redirect(`/preview?${blockQs}`)
  }

  if (types.includes('_Page')) {
    // Prefer hierarchical (ancestor-resolved) URL; fall back to default
    const path = toPath(item._metadata?.url?.hierarchical) ?? toPath(item._metadata?.url?.default)
    if (!path) return new Response('Not Found', { status: 404 })
    redirect(`${path}?${qs}`)
  }

  return new Response('Not Found', { status: 404 })
}
