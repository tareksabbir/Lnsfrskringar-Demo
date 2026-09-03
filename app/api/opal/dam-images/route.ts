import { NextRequest, NextResponse } from 'next/server'
import { authorizeOpal, unwrapOpalParameters } from '@/lib/opalAuth'
import { listDamImages } from '@/lib/damImages'

/**
 * List the images in the DAM so a caller can choose one before writing an
 * article.
 *
 * Opal cannot see pictures — it gets titles and URLs, nothing more. So this
 * tool is honest about what it is: a catalogue to pick a key from, not a
 * judgement about which image suits the text. The `url` on each result is
 * there so a PERSON can look before publishing.
 *
 * Read-only, but still behind the same bearer check as create_blog_article:
 * the asset titles and CDN URLs are the customer's, and an unauthenticated
 * endpoint that enumerates them is an inventory of their media library.
 */

export const revalidate = 0

export async function POST(req: NextRequest) {
  const auth = authorizeOpal(req, 'opal/dam-images')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  let body: unknown
  try {
    body = await req.json()
  } catch {
    // No body is fine here — every parameter is optional.
    body = {}
  }

  const params = unwrapOpalParameters(body) ?? {}
  const query = typeof params.query === 'string' ? params.query : undefined
  const limitRaw = params.limit
  const limit = typeof limitRaw === 'number' && Number.isFinite(limitRaw)
    ? Math.trunc(limitRaw)
    : 25

  const images = await listDamImages(query, limit)

  if (images === null) {
    return NextResponse.json({ error: 'Could not reach the media library.' }, { status: 502 })
  }

  return NextResponse.json({
    count: images.length,
    images,
    note: images.length === 0 && query
      ? `No image title contains "${query}". Call again without a query to see the whole library — `
        + 'titles here are original filenames, so they rarely describe what is in the picture.'
      : 'Pass an image\'s `key` as `imageKey` on an image, imageText, gallery or banner section.',
  })
}
