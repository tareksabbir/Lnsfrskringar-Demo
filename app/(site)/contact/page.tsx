import { redirect } from 'next/navigation'

/**
 * /contact — kept as a redirect to /contact-us.
 *
 * /contact was this page's original code route: reliable (fetched the form
 * directly by key) but not editable in Visual Builder. /contact-us
 * (app/(site)/contact-us/page.tsx) replaces it — same reliability, plus the
 * whole experience, including the form, is now editable in the CMS. This
 * redirect exists only so a link or bookmark pointing at /contact still
 * lands somewhere real.
 */
export default function ContactRedirect() {
  redirect('/contact-us')
}
