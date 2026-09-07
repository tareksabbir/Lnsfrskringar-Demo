import type { Metadata } from 'next'
import { draftMode } from 'next/headers'
import { fetchExperienceComposition } from '@/lib/experienceComposition'
import { RenderExperienceComposition } from '@/components/forms/ExperienceCompositionRenderer'
import { PreviewBridge } from '@/components/preview/PreviewBridge'

/**
 * /contact-us — the "Contact us" experience, editable in Visual Builder,
 * INCLUDING the referenced form block.
 *
 * This is the CMS-composition route the /contact code route (see that file)
 * was built to avoid: `@optimizely/cms-sdk`'s auto-generated composition
 * query never fetches `component` data on a structural node — which is what
 * a referenced form is — so the normal catch-all route (`[...slug]/page.tsx`,
 * using the SDK's generated query) renders this experience's form as
 * permanently empty. This route instead fetches the experience with a
 * hand-written query (`lib/experienceComposition.ts`) that requests
 * `component` at every level, the same way Optimizely's own reference
 * implementation does it (docs.developers.optimizely.com → "Render a form
 * with Optimizely Graph"). Every block that ISN'T a form renders through the
 * same registry-based `OptimizelyComponent` every other page already uses —
 * only the structural walk and the form's own data shape are custom here.
 *
 * A static route wins over the catch-all for this exact path in Next's
 * router, so this file — not `[...slug]/page.tsx` — serves /contact-us.
 */

const CONTACT_EXPERIENCE_KEY = process.env.CONTACT_EXPERIENCE_KEY ?? '62d5fce37f4e4a3c9291823c733bbe62'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
  return {
    title: 'Contact us',
    description: 'Questions about your insurance, a claim, or your account? Send us a message.',
    alternates: siteUrl ? { canonical: `${siteUrl}/contact-us` } : undefined,
  }
}

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function ContactUsPage({ searchParams }: Props) {
  const sp = await searchParams
  const sp_str = (key: string) => {
    const v = sp[key]
    return typeof v === 'string' ? v : ''
  }

  const dm = await draftMode()
  const cmsUrl = (process.env.OPTIMIZELY_CMS_URL ?? '').replace(/\/$/, '')

  // Same reasoning as the catch-all route: the signed preview_token is the
  // real authorization, and Next's draft cookie is withheld inside the CMS's
  // preview iframe (third-party context) — see that file's fuller comment.
  const previewToken = sp_str('preview_token') || undefined
  const inPreview = dm.isEnabled || !!previewToken
  const key = previewToken ? (sp_str('key') || CONTACT_EXPERIENCE_KEY) : CONTACT_EXPERIENCE_KEY

  const nodes = await fetchExperienceComposition(key, { previewToken, edit: inPreview })

  return (
    <div className="mx-auto w-full max-w-[64rem] px-5 py-12 md:py-16">
      {inPreview && <PreviewBridge cmsUrl={cmsUrl} />}
      {nodes ? (
        <RenderExperienceComposition nodes={nodes} />
      ) : (
        <p className="rounded-[var(--ot-radius-surface)] border border-fg/10 bg-surface p-6 text-body text-fg-muted">
          This page could not be loaded right now. Please try again shortly.
        </p>
      )}
    </div>
  )
}
