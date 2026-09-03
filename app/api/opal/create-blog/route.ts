import { NextRequest, NextResponse } from 'next/server'
import { getCmsAccessToken, cmsConfigured } from '@/lib/cmsApi'
import { buildBlogComposition, type BlogInput } from '@/lib/blogComposition'

/**
 * Create a blog article in the CMS from a plain description of it.
 *
 * The point of this endpoint is that the caller describes an ARTICLE — title,
 * intro, a list of sections — and never has to know how an Optimizely
 * composition is shaped. Opal calls it as a tool; a form, a script or curl can
 * call the same thing. See lib/blogComposition.ts for what it absorbs.
 *
 * Articles are created as DRAFTS. Anything that can be triggered by a language
 * model should land somewhere a person confirms before the public sees it, and
 * "publish straight to the live site" is not a decision this endpoint should be
 * able to make on its own. Publishing stays a human action in the CMS.
 */

const GATEWAY = (process.env.OPTIMIZELY_CMS_API_URL || 'https://api.cms.optimizely.com').replace(/\/$/, '')
const BLOG_FOLDER = process.env.CMS_BLOG_CONTAINER_KEY || '1330a97ad221400d8048329cda2ca918'

// Caps exist because the caller may be a model. They bound a runaway generation
// into something the CMS and the page can actually hold, and they are checked
// before any network call.
const MAX_TITLE = 120
const MAX_INTRO = 400
const MAX_SECTIONS = 40
const MAX_BODY = 20_000

/**
 * Constant-time comparison. A plain `===` on a secret leaks its length and
 * prefix through timing; the difference is small but free to avoid.
 */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/**
 * Fails CLOSED. If OPAL_TOOL_SECRET is unset the endpoint refuses every request
 * rather than running unauthenticated — the opposite of the CMP webhooks in this
 * repo, which skip verification entirely when their secret is missing and so are
 * open to anyone who finds the URL.
 */
function authorized(req: NextRequest): { ok: true } | { ok: false; status: number; error: string } {
  const secret = process.env.OPAL_TOOL_SECRET
  if (!secret) {
    return { ok: false, status: 503, error: 'OPAL_TOOL_SECRET is not set — this endpoint is disabled.' }
  }
  const header = req.headers.get('authorization') || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token || !safeEqual(token, secret)) {
    return { ok: false, status: 401, error: 'Unauthorized.' }
  }
  return { ok: true }
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || `article-${Date.now()}`
}

function validate(body: unknown): { ok: true; input: BlogInput } | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Body must be a JSON object.' }
  const b = body as Record<string, unknown>

  const title = typeof b.title === 'string' ? b.title.trim() : ''
  if (!title) return { ok: false, error: '`title` is required.' }
  if (title.length > MAX_TITLE) return { ok: false, error: `\`title\` must be ${MAX_TITLE} characters or fewer.` }

  const intro = typeof b.intro === 'string' ? b.intro.trim() : undefined
  if (intro && intro.length > MAX_INTRO) return { ok: false, error: `\`intro\` must be ${MAX_INTRO} characters or fewer.` }

  const sections = Array.isArray(b.sections) ? b.sections : []
  if (!sections.length) return { ok: false, error: '`sections` must be a non-empty array.' }
  if (sections.length > MAX_SECTIONS) return { ok: false, error: `At most ${MAX_SECTIONS} sections.` }

  const oversized = sections.find(s =>
    s && typeof s === 'object' && typeof (s as { body?: unknown }).body === 'string'
    && ((s as { body: string }).body.length > MAX_BODY))
  if (oversized) return { ok: false, error: `A section body exceeds ${MAX_BODY} characters.` }

  return {
    ok: true,
    input: {
      title,
      intro,
      heroImageKey: typeof b.heroImageKey === 'string' ? b.heroImageKey : undefined,
      heroImageAlt: typeof b.heroImageAlt === 'string' ? b.heroImageAlt : undefined,
      breadcrumb: Array.isArray(b.breadcrumb) ? b.breadcrumb.filter(x => typeof x === 'string') : undefined,
      sections: sections as BlogInput['sections'],
    },
  }
}

export async function POST(req: NextRequest) {
  const auth = authorized(req)
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  if (!cmsConfigured()) {
    return NextResponse.json({ error: 'CMS credentials are not configured.' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const checked = validate(body)
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 400 })

  const input = checked.input
  const composition = buildBlogComposition(input)
  const routeSegment = slugify(input.title)

  try {
    const token = await getCmsAccessToken()

    // Create in ONE call with the composition inline. Creating a shell first and
    // patching the composition afterwards initialises an internal layout that
    // cannot be repaired — delete and recreate is the only fix.
    const res = await fetch(`${GATEWAY}/v1/content`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contentType: 'BlankExperience',
        container: BLOG_FOLDER,
        initialVersion: {
          displayName: input.title,
          locale: 'en',
          routeSegment,
          properties: {
            seoTitle: { value: input.title },
            ...(input.intro ? { seoDescription: { value: input.intro } } : {}),
          },
          composition,
        },
      }),
    })

    if (res.status !== 201) {
      const detail = await res.text()
      console.error('[opal/create-blog] CMS rejected the article:', res.status, detail.slice(0, 800))
      return NextResponse.json(
        { error: 'The CMS rejected the article.', status: res.status },
        { status: 502 },
      )
    }

    // The response body is empty — the new key arrives in the Location header.
    const key = (res.headers.get('location') || '').replace(/\/$/, '').split('/').pop()

    return NextResponse.json({
      status: 'created',
      key,
      title: input.title,
      routeSegment,
      url: `/blog/${routeSegment}`,
      sections: composition.nodes.length,
      note: 'Created as a draft. Publish it in the CMS to make it live.',
    })
  } catch (err) {
    console.error('[opal/create-blog] failed:', err)
    return NextResponse.json({ error: 'Could not reach the CMS.' }, { status: 502 })
  }
}
