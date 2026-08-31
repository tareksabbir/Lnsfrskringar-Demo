import { notFound } from 'next/navigation'
import { draftMode } from 'next/headers'
import {
  getClient,
  getLocalizedContentByPath,
  getRequestBaseUrl,
  getRequestLocale,
  setRequestContext,
} from '@/lib/optimizely'
import { withAppContext } from '@optimizely/cms-sdk/react/server'
import { NextPreviewComponent } from '@optimizely/cms-sdk/react/nextjs'
import type { PreviewParams } from '@optimizely/cms-sdk'
import { CompositionRenderer } from '@/lib/CompositionRenderer'
import Script from 'next/script'

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

async function HomePage({ searchParams }: Props) {
  const cmsUrl  = (process.env.OPTIMIZELY_CMS_URL ?? '').replace(/\/$/, '')
  const dm      = await draftMode()
  const baseUrl = await getRequestBaseUrl()
  const locale  = await getRequestLocale()

  const sp = await searchParams
  const sp_str = (k: string): string => {
    const v = sp?.[k]
    return typeof v === 'string' ? v : Array.isArray(v) ? (v[0] ?? '') : ''
  }

  // Do NOT gate preview on draftMode(). Next's draft cookie is SameSite=Lax and
  // Visual Builder renders this page in an iframe on the CMS origin, so the
  // cookie is third-party there and never sent — dm.isEnabled is false even
  // though /api/draft/... enabled it. The signed preview_token is the real
  // authorization, so its presence is what marks a preview request.
  const hasPreviewToken = !!sp_str('preview_token')
  const inPreview       = dm.isEnabled || hasPreviewToken

  let exp: any

  if (inPreview && hasPreviewToken) {
    // ── Visual Builder / CMS preview ──────────────────────────────────────
    //
    // Without this branch the route fell straight through to the published
    // lookup below. The page still rendered (and the injector script still
    // loaded), so Visual Builder showed the site — but it was showing
    // PUBLISHED content with no edit context, which is why no section or block
    // could be selected. `ctx: 'edit'` is what puts the SDK into edit mode and
    // makes it emit the per-node preview attributes VB maps its overlays to.
    //
    // The catch-all at [...slug] already did this; the root route did not, and
    // Visual Builder lands here because the experience resolves to '/en/'.
    const previewLocale = sp_str('loc') || locale
    await setRequestContext(previewLocale as any)

    const previewParams: PreviewParams = {
      preview_token: sp_str('preview_token'),
      key:           sp_str('key'),
      ctx:           'edit',
      ver:           sp_str('ver'),
      loc:           previewLocale,
    }

    // Content Graph lags a few seconds behind a save in the editor, so the first
    // attempt can miss a just-edited draft. Same short backoff as the catch-all.
    //
    // Failures are LOGGED, not swallowed. getPreviewContent is the only call that
    // decorates the tree with __context (graph/index.js), and __context.edit is
    // what makes the SDK emit the data-epi-block-id attributes Visual Builder
    // maps clicks to. If this call fails we fall through to published content,
    // which renders fine but carries no editing attributes — so VB shows the
    // page and nothing is selectable. Silently swallowing that made it look
    // like a Visual Builder problem instead of a failed preview fetch.
    exp = null
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 600))
      try {
        exp = await getClient().getPreviewContent(previewParams, { cache: false })
        break
      } catch (err) {
        console.error(
          `[home] preview fetch failed (attempt ${attempt + 1}/3) — ` +
          `key=${previewParams.key} ver=${previewParams.ver} loc=${previewParams.loc}:`,
          err,
        )
      }
    }
    if (!exp) {
      console.error(
        '[home] preview unavailable — falling back to PUBLISHED content. ' +
        'Visual Builder will render the page but nothing will be selectable, ' +
        'because editing attributes only come from a successful preview fetch.',
      )
    }
  }

  // Published lookup — also the fallback when a preview fetch came back empty.
  if (!exp?.composition?.nodes) {
    // Try root, then the common CMS home slugs.
    for (const path of ['/', '/home', '/base-home']) {
      exp = await getLocalizedContentByPath(path, locale, baseUrl)
      if (exp?.composition?.nodes) break
    }
  }

  if (!exp?.composition?.nodes) notFound()

  // One line that says whether Visual Builder will be able to select anything.
  // `pa()` emits data-epi-block-id only when __context.edit is true, and
  // __context is attached exclusively by getPreviewContent — so this flag is the
  // difference between an editable page and an inert one.
  if (inPreview) {
    const editable = exp?.__context?.edit === true
    console.log(
      `[home] preview=on  editContext=${editable ? 'YES — blocks selectable' : 'NO — page will be inert in Visual Builder'}` +
      `  source=${exp?.__context ? 'preview' : 'published'}`,
    )
  }

  return (
    <>
      {inPreview && cmsUrl && (
        <Script src={`${cmsUrl}/util/javascript/communicationinjector.js`} />
      )}
      {inPreview && <NextPreviewComponent />}
      <CompositionRenderer nodes={exp.composition.nodes} />
    </>
  )
}

export default withAppContext(HomePage)
