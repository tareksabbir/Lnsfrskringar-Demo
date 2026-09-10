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

        // ── Why there is no "don't go backwards" rule here ──────────────────
        //
        // An earlier version refused to follow a `contentSaved` whose `ver` was
        // lower than the one on screen, on the theory that a save always makes a
        // higher version and so a lower one meant "the CMS is dragging us back to
        // the original". Measurement killed it: on LF Stockholm Home the original
        // sits at ver=229 while the `copychange` variation is ver=226. Version
        // numbers are allocated per content item, not per variation, so ordering
        // says nothing about which is the variation.
        //
        // The revert is also not ours to prevent: the CMS replaces the iframe's
        // `src` attribute, which no client-side handler in the frame can veto.
        // See Optimizely.md → Content variations.
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
