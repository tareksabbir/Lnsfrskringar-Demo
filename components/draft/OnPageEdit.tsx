'use client'

import { useEffect } from 'react'

/**
 * In-place property updates while an editor types in Visual Builder.
 *
 * The CMS emits `contentSaved` into the preview iframe with the properties that
 * changed. `NextPreviewComponent` already handles this correctly by refetching
 * from Graph with a fresh preview token — but that is a round trip, and a round
 * trip is the difference between "live" and "a moment later". This patches the
 * DOM immediately and lets the refetch land underneath as the source of truth.
 *
 * ── Why this did nothing before ─────────────────────────────────────────────
 * It matched `[data-epi-property-name="…"]`. Nothing in this codebase or in the
 * SDK emits that attribute. `getPreviewUtils().pa('headline')` emits
 * `data-epi-edit="headline"` — that is the documented attribute and the one the
 * CMS itself looks for when placing property overlays. So the selector never
 * matched, every save fell through to the refetch, and the fast path was dead
 * code that looked alive.
 */

type SavedProperty = { name: string; value: unknown }
type ContentSavedMessage = { properties?: SavedProperty[] }

declare global {
  interface Window {
    epi?: {
      subscribe:    (event: string, cb: (msg: ContentSavedMessage) => void) => void
      unsubscribe?: (event: string, cb: (msg: ContentSavedMessage) => void) => void
    }
  }
}

/**
 * Only plain strings are patched, and only as text.
 *
 * Two reasons, and they point the same way. A rich-text property arrives as a
 * node tree, not HTML, so `innerHTML` would write "[object Object]" into the
 * page — worse than waiting. And writing editor-supplied markup straight into
 * the DOM is an injection the rest of this codebase is careful to route through
 * sanitizeCmsHtml. Anything that is not a string is left to the refetch, which
 * renders it through the normal component path with the normal escaping.
 */
function patch(name: string, value: unknown): number {
  if (typeof value !== 'string') return 0

  const selector = `[data-epi-edit="${CSS.escape(name)}"]`
  const targets = document.querySelectorAll<HTMLElement>(selector)

  let patched = 0
  targets.forEach(el => {
    // Block containers manage their own on-page editing — skip their children.
    if (el.closest('[is-on-page-editing-block-container]')) return
    el.textContent = value
    patched++
  })
  return patched
}

export default function OnPageEdit() {
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined

    function handleContentSaved(msg: ContentSavedMessage) {
      for (const prop of msg.properties ?? []) {
        if (prop?.name) patch(prop.name, prop.value)
      }
      // Whatever was not patched here — rich text, images, structural changes —
      // arrives via NextPreviewComponent's refetch a moment later. This is an
      // optimisation on top of that, never a replacement for it.
    }

    // `window.epi` is created by communicationinjector.js, which is a separate
    // <Script> and may not have run yet. Poll briefly rather than miss the
    // subscription entirely.
    function trySubscribe() {
      if (cancelled) return
      if (window.epi?.subscribe) {
        window.epi.subscribe('contentSaved', handleContentSaved)
      } else {
        timer = setTimeout(trySubscribe, 100)
      }
    }

    trySubscribe()

    return () => {
      cancelled = true
      clearTimeout(timer)
      window.epi?.unsubscribe?.('contentSaved', handleContentSaved)
    }
  }, [])

  return null
}
