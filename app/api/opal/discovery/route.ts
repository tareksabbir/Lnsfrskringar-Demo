import { NextRequest, NextResponse } from 'next/server'

/**
 * Opal tool manifest.
 *
 * Opal registers a tool service by its discovery URL (Opal → Connectors →
 * Registries → Discovery URL) and reads this document to learn what the service
 * can do. If it is unreachable or malformed, Opal simply finds no tools — there
 * is no error surfaced to the author, so keep this endpoint boring and public.
 *
 * Deliberately unauthenticated: it is a description of an interface, not a way
 * to use it. Every tool it advertises requires a bearer token of its own.
 *
 * ── Two things here were learned by being wrong about them ──────────────────
 *  - `auth_requirements` names an IDENTITY provider whose credentials Opal
 *    resolves for the user ("google", "microsoft", Opti ID). There is no
 *    "bearer" provider, and inventing one makes Opal reject the whole manifest
 *    with a 400 at registration. The registry's own Bearer Token is a separate
 *    mechanism that needs no declaration, so this stays empty.
 *  - Parameter types come from Opal's ParameterType enum:
 *    string | integer | number | boolean | list | dictionary. "array" is not
 *    one of them.
 */

function callbackOrigin(req: NextRequest): string {
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host')
  if (!host) return req.nextUrl.origin.replace(/\/$/, '')
  const proto = req.headers.get('x-forwarded-proto')
    || (host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https')
  return `${proto}://${host}`.replace(/\/$/, '')
}

// Written for a model to read. Each entry says what the section looks like and
// when to reach for it, because "accordion" alone does not tell an author that
// it is the right shape for a list of mistakes.
const SECTIONS_DOC = [
  'The body of the article, in order. Each entry is an object with a `type`.',
  '',
  'TEXT AND STRUCTURE',
  '• {"type":"text","heading":"…","body":"<p>…</p><ul><li>…</li></ul>"} — a heading and prose.',
  '  `body` accepts simple HTML: p, ul/ol/li, strong, em, a, h3.',
  '• {"type":"steps","heading":"…","intro":"…","steps":["First…","Then…"]} — a numbered',
  '  procedure. Use this rather than a bulleted text section when order matters.',
  '• {"type":"accordion","heading":"…","items":[{"question":"…","answer":"…"}]} — collapsible',
  '  rows. Good for FAQs, "common mistakes", and any long list the reader will skim.',
  '• {"type":"table","heading":"…","intro":"…","columnLabels":["Basic","Plus"],',
  '   "rows":[{"label":"Excess","cells":["1500 kr","500 kr"]}]} — a comparison grid.',
  '  Every row needs one cell per column label.',
  '• {"type":"divider","label":"optional short words"} — a visual break between parts.',
  '',
  'IMAGES  (get a `key` from the list_dam_images tool first — never invent one)',
  '• {"type":"image","imageKey":"…","alt":"…","caption":"…"} — one full-width image.',
  '• {"type":"imageText","imageKey":"…","alt":"…","heading":"…","body":"<p>…</p>",',
  '   "imageSide":"right","ctaLabel":"…","ctaUrl":"…"} — image beside text, two columns.',
  '• {"type":"gallery","heading":"…","images":[{"imageKey":"…","alt":"…"}]} — up to 3 side by side.',
  '',
  'EMPHASIS',
  '• {"type":"quote","text":"…","author":"…","role":"…"} — a pull quote from a named person.',
  '• {"type":"callout","heading":"…","body":"…","ctaLabel":"…","intent":"warning"} — a tinted',
  '  panel. intent: info, success, warning, danger, neutral, brand. Keep body under 200 chars.',
  '• {"type":"stats","heading":"…","stats":[{"value":"73%","label":"of claims…"}]} — up to 4',
  '  figures. `value` is the big number, `label` says what it counts.',
  '• {"type":"banner","heading":"…","body":"…","imageKey":"…","ctaLabel":"…","ctaUrl":"…"} —',
  '  a full-width call to action. At most one per article, usually near the end.',
  '• {"type":"video","videoUrl":"https://youtu.be/…","title":"…","caption":"…"} — YouTube or',
  '  Vimeo only; any other URL is dropped.',
  '• {"type":"cards","heading":"…","cards":[{"title":"…","body":"…","ctaLabel":"…"}]} — up to 3.',
  '• {"type":"links","heading":"Related links","links":[{"label":"…","url":"…"}]} — a link list.',
  '',
  'Prefer several short sections over one long text section. A section whose',
  'required fields are missing is skipped, not fatal — the rest of the article',
  'still publishes.',
].join('\n')

/**
 * The manifest changes; a registry that read it once does not.
 *
 * Opal caches the discovery document at registration. After the tool list grew
 * from one function to two, Opal kept answering from the old copy and reported
 * — correctly, for what it could see — that list_dam_images did not exist. From
 * the outside there was no way to tell "never re-read it" from "read it and
 * something is wrong", so every fetch is logged with the caller and the tool
 * count. If Opal has not re-read this, no line appears.
 */
function logFetch(req: NextRequest, tools: string[]) {
  const ua = req.headers.get('user-agent') || 'unknown'
  console.info(
    `[opal/discovery] manifest served — ${tools.length} tools (${tools.join(', ')}) `
    + `to ${ua.slice(0, 120)}`,
  )
}

export function GET(req: NextRequest) {
  const base = callbackOrigin(req)
  logFetch(req, ['list_dam_images', 'create_blog_article'])

  return NextResponse.json({
    functions: [
      {
        name: 'list_dam_images',
        description:
          'List the images available in the Optimizely DAM media library, with their '
          + 'keys, titles and preview URLs. Call this BEFORE create_blog_article whenever '
          + 'the article should contain a picture, and pass the `key` you choose as '
          + '`imageKey`. Image keys cannot be guessed — an invented one produces an empty '
          + 'image. Note that titles are usually original filenames and rarely describe '
          + 'what is in the picture, so the preview URL is there for a person to check.',
        endpoint: `${base}/api/opal/dam-images`,
        http_method: 'POST',
        auth_requirements: [],
        parameters: [
          {
            name: 'query',
            type: 'string',
            description:
              'Optional case-insensitive substring to match against image titles. '
              + 'Omit it to see the whole library, which is usually the more useful call.',
            required: false,
          },
          {
            name: 'limit',
            type: 'integer',
            description: 'How many images to return, 1–50. Defaults to 25.',
            required: false,
          },
        ],
      },
      {
        name: 'create_blog_article',
        description:
          'Write a blog article into the Optimizely CMS as a draft. Use this when '
          + 'someone asks for an article, guide or blog post to be created on the site. '
          + 'Describe the article in sections; the tool builds the page. '
          + 'The article is created as a DRAFT and a person publishes it in the CMS.',
        endpoint: `${base}/api/opal/create-blog`,
        http_method: 'POST',
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
            type: 'list',
            description:
              'Trail shown above the title, e.g. ["Private", "Tips & guides", "Renovation"].',
            required: false,
          },
          {
            name: 'heroImageKey',
            type: 'string',
            description:
              'DAM image key for the lead image under the title, from list_dam_images. '
              + 'Leave it out rather than guessing.',
            required: false,
          },
          {
            name: 'heroImageAlt',
            type: 'string',
            description: 'Alt text for the lead image. Describe the picture, do not repeat the title.',
            required: false,
          },
          {
            name: 'sections',
            type: 'list',
            description: SECTIONS_DOC,
            required: true,
          },
        ],
      },
    ],
  })
}
