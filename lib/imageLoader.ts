'use client'

import type { ImageLoaderProps } from 'next/image'

/**
 * Custom next/image loader.
 *
 * Why this exists: Vercel's built-in Image Optimization API is quota/spend
 * capped per project. When the cap is hit, `/_next/image` returns HTTP 402
 * (`OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED`) and images silently fail to
 * render. This loader bypasses Vercel's optimizer entirely by returning a URL
 * the browser fetches directly from the source, so image delivery no longer
 * depends on the Vercel optimization quota.
 *
 * - DAM / CMP CDN (`*.cmp.optimizely.com`): DOES resize server-side, via a
 *   `width` query param. Nothing else works — `w`, `d`, `fm`, `format`,
 *   `quality`, `auto`, `tr`, `resize`, `size` and `preset` are all ignored and
 *   silently return the original. Measured on a 6720x4480 source:
 *
 *       (none)      6720x4480   3488 KB
 *       width=400    400x266      28 KB
 *       width=800    800x533      82 KB
 *       width=1600  1600x1066    251 KB
 *
 *   Transformed variants come back with `x-image-transformed: true` and
 *   `cache-control: max-age=86400` and are Cloudflare-cached, so the resize
 *   cost is paid once per size, not per visitor.
 * - Optimizely SaaS CMS media (`*.cms.optimizely.com` and other
 *   `*.optimizely.com` hosts): does NOT resize — width/quality params are
 *   ignored and the original is always returned. Serve the canonical URL so the
 *   srcset is one cacheable file rather than N identical copies. Since every
 *   asset now comes from DAM this branch is effectively legacy.
 * - Unsplash (`images.unsplash.com`): supports native resizing via query
 *   params, so we keep responsive behaviour by passing width/quality/auto.
 * - Local/relative assets (`/...`) and anything else: returned as-is.
 */

/**
 * The CMP image service refuses anything larger with
 * `400 Requested size is higher than max allowed size (5000x5000)` — a hard
 * error, not a fallback to the original, so this clamp is load-bearing. Next's
 * default deviceSizes stop at 3840, but an explicit `width={...}` on an <Image>
 * is passed straight through and can exceed it.
 */
const CMP_MAX_WIDTH = 5000
export default function imageLoader({ src, width, quality }: ImageLoaderProps): string {
  // Local/static assets under /public — serve as-is.
  if (src.startsWith('/')) return src

  let url: URL
  try {
    url = new URL(src)
  } catch {
    return src
  }

  // Unsplash resizes on its own CDN — keep images responsive.
  if (url.hostname === 'images.unsplash.com') {
    url.searchParams.set('w', String(width))
    url.searchParams.set('q', String(quality ?? 75))
    url.searchParams.set('auto', 'format')
    return url.toString()
  }

  // DAM / CMP CDN — resizes on its own edge. Without this every card thumbnail
  // downloaded the full-resolution original: the LF home page pulled ~17 MB of
  // Unsplash JPEGs (one was 3.9 MB) to fill slots a few hundred pixels wide.
  //
  // `quality` is deliberately not forwarded — the service ignores it, and
  // sending it would only fragment the CDN cache across identical variants.
  if (url.hostname.endsWith('.cmp.optimizely.com')) {
    // SVGs are returned unchanged whatever we ask for, so no special-casing:
    // the param is simply inert for them.
    if (width) {
      url.searchParams.set('width', String(Math.min(width, CMP_MAX_WIDTH)))
    }
    return url.toString()
  }

  // Optimizely SaaS CMS media (and any other optimizely.com host): the CMS
  // ignores resize params and returns the original, so serve the canonical URL
  // directly — straight from the CMS, never through Vercel's optimizer.
  if (url.hostname.endsWith('.optimizely.com')) {
    return src
  }

  return src
}
