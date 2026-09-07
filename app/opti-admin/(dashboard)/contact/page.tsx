export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { listSubmissions, contactStoreIsDurable } from '@/lib/contactStore'

export const metadata: Metadata = { title: 'Contact messages — Accelerator Admin' }

/**
 * Where contact-form submissions are read.
 *
 * A server component reading the store directly, rather than a client component
 * calling an API route. There is no second endpoint to protect that way: the
 * `(dashboard)` group is already behind the admin session cookie, and adding a
 * `/api/opti-admin/contact` route would mean a second place someone could reach
 * a stranger's email address.
 *
 * Messages expire after thirty days (lib/contactStore.ts). That is the whole
 * retention policy, and it is enforced by the store rather than by anyone
 * remembering to prune.
 */

function formatWhen(iso: string, locale = 'en-GB'): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium', timeStyle: 'short',
  }).format(d)
}

export default async function ContactMessagesPage() {
  const submissions = await listSubmissions(50)
  const durable = contactStoreIsDurable()

  return (
    <div className="px-lg py-lg">
      <div className="mb-md">
        <h1 className="text-[1.5rem] font-semibold tracking-[-0.02em] leading-tight text-fg">
          Contact messages
        </h1>
        <p className="mt-xs max-w-[70ch] text-[0.9375rem] leading-relaxed text-fg-muted">
          Submissions from the contact form on <code>/contact</code>. They are held for
          thirty days and then expire. Nothing is emailed and nothing is written into
          the content tree.
        </p>
      </div>

      {!durable && (
        <div className="mb-md border border-fg/15 bg-surface p-md text-[0.9375rem] text-fg">
          <strong className="font-semibold">Not durable.</strong>{' '}
          No KV store is configured, so submissions live in memory on one serverless
          instance and will not appear here reliably. Set <code>KV_REST_API_URL</code> and{' '}
          <code>KV_REST_API_TOKEN</code>.
        </div>
      )}

      <div className="border-t border-fg/[0.07] pt-lg">
        {submissions.length === 0 ? (
          <p className="text-[0.9375rem] text-fg-muted">No messages yet.</p>
        ) : (
          <ul className="flex list-none flex-col gap-md p-0">
            {submissions.map(s => (
              <li key={s.id} className="border border-fg/[0.12] bg-surface p-md">
                <div className="flex flex-wrap items-baseline justify-between gap-sm">
                  <p className="text-[1rem] font-semibold text-fg">
                    {s.subject || '(no subject)'}
                  </p>
                  <time
                    dateTime={s.receivedAt}
                    className="text-[0.8125rem] text-fg-muted"
                  >
                    {formatWhen(s.receivedAt)}
                  </time>
                </div>

                <p className="mt-xs text-[0.875rem] text-fg-muted">
                  {s.name} ·{' '}
                  <a
                    href={`mailto:${encodeURIComponent(s.email)}`}
                    className="underline underline-offset-2 hover:text-fg"
                  >
                    {s.email}
                  </a>
                  {s.pagePath && <> · from <code>{s.pagePath}</code></>}
                </p>

                {/* whitespace-pre-wrap, not dangerouslySetInnerHTML: this text
                    was typed by a stranger and is rendered as text. */}
                <p className="mt-sm whitespace-pre-wrap text-[0.9375rem] leading-relaxed text-fg">
                  {s.message}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
