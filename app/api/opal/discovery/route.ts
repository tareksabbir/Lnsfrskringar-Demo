import { NextResponse } from 'next/server'

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

export function GET() {
  const base = (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/$/, '')

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
        auth_requirements: [
          {
            provider: 'bearer',
            scope_bundle: 'write',
            required: true,
          },
        ],
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
            type: 'array',
            description:
              'Trail shown above the title, e.g. ["Private", "Tips & guides", "Renovation"].',
            required: false,
          },
          {
            name: 'sections',
            type: 'array',
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
