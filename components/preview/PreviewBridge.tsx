import Script from 'next/script'
import { NextPreviewComponent } from '@optimizely/cms-sdk/react/nextjs'
import OnPageEdit from '@/components/draft/OnPageEdit'

/**
 * Everything a page needs to be live-editable in Visual Builder, in one place.
 *
 * Live preview is three cooperating pieces, and a page that has two of them is
 * not two-thirds live — it is broken in a way nobody notices:
 *
 *   1. communicationinjector.js — the CMS's bridge script. It creates
 *      `window.epi` and dispatches `contentSaved` into this iframe. Without it
 *      nothing arrives at all.
 *   2. NextPreviewComponent — the SDK's handler. Refetches from Graph with a
 *      fresh preview token and rerenders. This is the correct path and the
 *      source of truth.
 *   3. OnPageEdit — patches changed string properties into the DOM immediately,
 *      so a keystroke shows up before the round trip lands.
 *
 * These were previously spread across seven hand-written pairs in the slug
 * route, the home route and /preview, and (3) was mounted in none of them — it
 * lived only in the `(draft)` group, which covers a single-block route. So the
 * in-place patch had never run on a real page.
 *
 * Rendering all three together is the point: they cannot drift apart again.
 *
 * @param cmsUrl  CMS origin. Falsy skips the script — a preview without the
 *                bridge is inert, but rendering a `<script src="/util/…">`
 *                against our own origin would be worse.
 */
export function PreviewBridge({ cmsUrl }: { cmsUrl?: string | null }) {
  const base = (cmsUrl ?? '').replace(/\/$/, '')

  return (
    <>
      {base && <Script src={`${base}/util/javascript/communicationinjector.js`} />}
      <NextPreviewComponent />
      <OnPageEdit />
    </>
  )
}

export default PreviewBridge
