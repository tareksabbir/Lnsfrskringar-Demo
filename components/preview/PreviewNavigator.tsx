'use client'

import { useRouter } from 'next/navigation'
import { PreviewComponent } from '@optimizely/cms-sdk/react/client'

/**
 * Handles the CMS's `contentSaved` navigation, replacing the SDK's
 * `NextPreviewComponent`.
 *
 * ── Why not the SDK's version ────────────────────────────────────────────────
 * `NextPreviewComponent` navigates to `eventData.previewUrl` verbatim. That URL
 * comes from the CMS, and when it arrives without the preview parameters this
 * page is currently rendering under, following it drops the whole preview
 * context: `ver` is what selects a *content variation* (a variation is another
 * version of the same key, not separate content), so losing it lands the iframe
 * on the original — which looks exactly like "switching to a variation doesn't
 * stick, it snaps back to Original".
 *
 * So: parameters present in the incoming URL always win — a real variation
 * switch sends a different `ver` and must be honoured — and only ABSENT ones are
 * filled in from the URL already on screen. Never overriding is the whole point;
 * the alternative pins the iframe to one version and breaks switching entirely.
 *
 * The one-line log is deliberate. Preview navigation is invisible when it goes
 * wrong, and "what did the CMS ask for, and where did we actually go" is the
 * only question worth answering when it does.
 */

/** The parameters that make a request a preview request; see the page routes. */
const PREVIEW_PARAMS = ['preview_token', 'key', 'ver', 'loc', 'ctx'] as const

const trimSlash = (p: string) => p.replace(/\/$/, '') || '/'

export default function PreviewNavigator() {
  const router = useRouter()

  return (
    <PreviewComponent
      onNavigate={(rawUrl) => {
        const here = new URL(window.location.href)

        let target: URL
        try {
          target = new URL(rawUrl, window.location.origin)
        } catch {
          console.warn('[preview] contentSaved carried an unparseable previewUrl:', rawUrl)
          return
        }

        // The URL is supplied by the CMS through a window event, so treat it as
        // input rather than instruction: this navigates within our own origin
        // only. Anything else is refused rather than followed.
        if (target.origin !== window.location.origin) {
          console.warn('[preview] refusing cross-origin previewUrl:', target.origin)
          return
        }

        // ── Never follow a version downgrade ────────────────────────────────
        //
        // Measured in Visual Builder, switching to a content variation:
        //
        //   12:32:14  /site/load  url = /?…ver=194   the variation, loaded fine
        //   12:32:20  /site/load  url = /?…ver=187   six seconds later, the original
        //
        // Nothing was saved in between. The CMS emits `contentSaved` carrying a
        // previewUrl for the ORIGINAL, and following it navigates the iframe off
        // the variation — the editor then syncs its Variations dropdown to what
        // the page reports, so the selection appears to "snap back to Original".
        //
        // A real save always produces a HIGHER version number, so the invariant
        // is: for the same content, never move backwards. A deliberate switch to
        // an older version (picking Original in the dropdown) does not come
        // through here at all — the CMS sets the iframe's src directly.
        const sameContent = target.searchParams.get('key') === here.searchParams.get('key')
        const currentVer = Number(here.searchParams.get('ver'))
        const targetVer = Number(target.searchParams.get('ver'))
        if (
          sameContent
          && Number.isFinite(currentVer)
          && Number.isFinite(targetVer)
          && targetVer < currentVer
        ) {
          console.warn(
            `[preview] ignoring contentSaved pointing at an older version `
            + `(showing ${currentVer}, asked for ${targetVer}) — refreshing in place instead`,
          )
          router.refresh()
          return
        }

        for (const param of PREVIEW_PARAMS) {
          if (target.searchParams.has(param)) continue
          const current = here.searchParams.get(param)
          if (current) target.searchParams.set(param, current)
        }

        // Recomputed after the backfill — the SDK decided same/different before
        // these parameters existed on the target, so its answer is stale here.
        const isSameUrl =
          trimSlash(target.pathname) === trimSlash(here.pathname) && target.search === here.search

        console.log('[preview] contentSaved →', {
          from: here.pathname + here.search,
          to: target.pathname + target.search,
          action: isSameUrl ? 'refresh' : 'navigate',
        })

        if (isSameUrl) router.refresh()
        else router.push(target.pathname + target.search, { scroll: false })
      }}
    />
  )
}
