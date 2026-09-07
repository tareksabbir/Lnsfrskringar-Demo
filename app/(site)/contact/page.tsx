import type { Metadata } from 'next'
import { fetchForm, RenderOptiForm } from '@/cms/components/OptiFormsContainerData'

/**
 * /contact — a code route, not a CMS composition.
 *
 * A form placed ON A PAGE has to be a "reference" (Optimizely rejects
 * embedding a layoutType:'form' section inline into an experience). That
 * reference shows up in Graph as a structural node whose own `component`
 * field — the one carrying the form's key — is only reachable with a query
 * shape this app's auto-generated page/composition query does not produce.
 * So a form referenced from a Visual Builder page never gets a usable key at
 * render time; see the comment on `fetchForm` in
 * cms/components/OptiFormsContainerData.tsx for the full trail.
 *
 * Fetching the form directly by its known content key, from a plain code
 * route, sidesteps that gap entirely — same trade-off as /blog (see
 * app/(site)/blog/page.tsx): not editable in Visual Builder, but reliable.
 * The form BLOCK itself is still a normal CMS shared block, editable in the
 * CMS the normal way (fields, validators, Submit URL) — only its placement
 * on this page is fixed in code rather than composed in the Outline.
 */

const CONTACT_FORM_KEY = process.env.CONTACT_FORM_KEY ?? '150076c57533497c8a82adf77750177e'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? '').replace(/\/$/, '')
  return {
    title: 'Contact us',
    description: 'Questions about your insurance, a claim, or your account? Send us a message.',
    alternates: siteUrl ? { canonical: `${siteUrl}/contact` } : undefined,
  }
}

export default async function ContactPage() {
  const form = await fetchForm(CONTACT_FORM_KEY)

  return (
    <div className="mx-auto w-full max-w-[42rem] px-5 py-12 md:py-16">
      <header className="mb-10">
        <h1 className="text-hero font-bold text-brand">Contact us</h1>
        <p className="mt-3 text-body text-fg-muted">
          Questions about your insurance, a claim, or your account? Send us a message and
          we will come back to you within two working days.
        </p>
      </header>

      {form ? (
        <RenderOptiForm form={form} />
      ) : (
        <p className="rounded-[var(--ot-radius-surface)] border border-fg/10 bg-surface p-6 text-body text-fg-muted">
          The contact form could not be loaded right now. Please try again shortly.
        </p>
      )}
    </div>
  )
}
