import { NextRequest, NextResponse } from 'next/server'

/**
 * Opal tool manifest.
 *
 * Opal registers a tool service by its discovery URL (Opal → Tools → Registries
 * → Discovery URL) and reads this document to learn what the service can do.
 * If it is unreachable or malformed, Opal simply finds no tools — there is no
 * error surfaced to the author, so keep this endpoint boring and public.
 *
 * Deliberately unauthenticated: it is a description of an interface, not a way
 * to use it. Every tool it advertises requires a bearer token of its own.
 */

/**
 * The origin Opal should call back on.
 *
 * Derived from the request that reached us, NOT from NEXT_PUBLIC_SITE_URL.
 * That variable is a canonical-URL setting for SEO, and pointing it at
 * localhost during development is normal — but a manifest is a set of live
 * addresses, and one advertising http://localhost:3000 sends every Opal tool
 * call into the void with no error anyone can see. Whatever host fetched this
 * document can, by definition, be reached.
 *
 * `x-forwarded-*` is what Vercel's proxy sets; `req.nextUrl.origin` is the
 * fallback for a direct hit.
 */
function callbackOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  if (!host) return req.nextUrl.origin.replace(/\/$/, '')
  const proto = req.headers.get('x-forwarded-proto')
    || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
  return `${proto}://${host}`.replace(/\/$/, '')
}

export function GET(req: NextRequest) {
  const base = callbackOrigin(req)

  return NextResponse.json({
    functions: [
      {
        name: 'create_blog_article',
        description:
          'Write a blog article into the Optimizely CMS as a draft. Use this when '
          + 'someone asks for an article, guide or blog post to be created on the site. '
          + 'Describe the article in sections; the tool builds the page. '
          + 'The article is created as a DRAFT and a person publishes it in the CMS.',
        endpoint: `${base}/api/opal/create-blog`,
        http_method: 'POST',
        // Deliberately empty.
        //
        // `auth_requirements` declares an IDENTITY PROVIDER whose credentials
        // Opal resolves on the user's behalf and forwards to the tool — the
        // values are providers like "google" or "microsoft" (see the Opal tools
        // SDK's @requires_auth). "bearer" is not one of them, and declaring it
        // makes Opal reject the whole manifest with a 400 during registration.
        //
        // The bearer token entered on the tool registry is a separate mechanism:
        // Opal simply puts it in the Authorization header of every call, which
        // is what /api/opal/create-blog checks. It needs no declaration here.
        auth_requirements: [],
        parameters: [
          {
            name: 'title',
            type: 'string',
            description: 'Article headline. Max 120 characters.',
            required: true,
          },
          {
            name: 'intro',
            type: 'string',
            description: 'One or two sentences under the headline. Max 400 characters.',
            required: false,
          },
          {
            name: 'breadcrumb',
            // "list", not "array" — Opal's ParameterType enum is
            // string | integer | number | boolean | list | dictionary.
            type: 'list',
            description:
              'Trail shown above the title, e.g. ["Private", "Tips & guides", "Renovation"].',
            required: false,
          },
          {
            name: 'sections',
            type: 'list',
            description:
              'The body of the article, in order. Each entry is an object with a `type`:\n'
              + '• {"type":"text","heading":"…","body":"<p>…</p><ul><li>…</li></ul>"} — a heading '
              + 'and prose. `body` accepts simple HTML: p, ul/ol/li, strong, em, a, h3.\n'
              + '• {"type":"accordion","heading":"…","items":[{"question":"…","answer":"…"}]} — '
              + 'collapsible rows, good for FAQs and "common mistakes" lists.\n'
              + '• {"type":"quote","text":"…","author":"…","role":"…"} — a pull quote.\n'
              + '• {"type":"callout","heading":"…","body":"…","ctaLabel":"…","intent":"info"} — '
              + 'a tinted panel. intent: info, success, warning, danger, neutral, brand.\n'
              + '• {"type":"cards","heading":"…","cards":[{"title":"…","body":"…","ctaLabel":"…"}]} — '
              + 'up to three side-by-side cards.\n'
              + '• {"type":"links","heading":"…","links":[{"label":"…","url":"…"}]} — a list of links.\n'
              + 'Prefer several short sections over one long text section.',
            required: true,
          },
        ],
      },
    ],
  })
}
