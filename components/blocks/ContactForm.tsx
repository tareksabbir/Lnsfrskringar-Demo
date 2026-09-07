'use client'

import { useId, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * A contact form that actually submits, to /api/contact.
 *
 * Client, because it owns submit state. The labels come from the CMS; the four
 * fields do not — see cms/content-types/OT_ContactForm.ts for why an editor can
 * change what the form says but not what it collects.
 *
 * It is a real <form>: it works with the keyboard, it works with a password
 * manager, and it would still submit if the JavaScript failed to load — the
 * handler only intercepts to avoid a full page reload.
 */

export type ContactFormProps = {
  heading?:        string
  intro?:          string
  nameLabel?:      string
  emailLabel?:     string
  subjectLabel?:   string
  messageLabel?:   string
  consentText?:    string
  submitLabel?:    string
  successMessage?: string
  layout?:         'stacked' | 'compact'
  color?:          'surface' | 'canvas' | 'tint'
  /** Precomputed data-epi-edit attributes. Empty outside Visual Builder. */
  epi?: Partial<Record<string, Record<string, string | undefined>>>
}

const BG: Record<string, string> = {
  surface: 'bg-surface',
  canvas:  'bg-canvas',
  tint:    'bg-brand-tint',
}

const FIELD =
  'mt-xs w-full border-b border-fg/25 bg-canvas px-sm py-2 text-body text-fg '
  + 'outline-none transition-colors focus:border-brand motion-reduce:transition-none '
  + 'placeholder:text-fg-muted/60 aria-[invalid=true]:border-accent'

const LABEL = 'block text-body font-semibold text-fg'

type State = 'idle' | 'sending' | 'sent' | 'error'

export default function ContactForm({
  heading, intro,
  nameLabel = 'Name', emailLabel = 'Email',
  subjectLabel = 'Subject', messageLabel = 'Message',
  consentText = 'I agree that my details may be used to answer my enquiry.',
  submitLabel = 'Send message',
  successMessage = 'Thank you — your message has been received. We will be in touch.',
  layout = 'stacked', color = 'surface', epi = {},
}: ContactFormProps) {
  const id = useId()
  const [state, setState] = useState<State>('idle')
  const [invalid, setInvalid] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (state === 'sending') return

    const data = new FormData(e.currentTarget)
    setState('sending')
    setInvalid([])
    setError(null)

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name:    data.get('name'),
          email:   data.get('email'),
          subject: data.get('subject'),
          message: data.get('message'),
          consent: data.get('consent') === 'on',
          company: data.get('company'), // honeypot
          pagePath: typeof window !== 'undefined' ? window.location.pathname : undefined,
        }),
      })

      if (res.ok) {
        setState('sent')
        return
      }

      const body = await res.json().catch(() => ({}))
      setInvalid(Array.isArray(body.fields) ? body.fields : [])
      setError(typeof body.error === 'string' ? body.error : 'Something went wrong.')
      setState('error')
    } catch {
      setError('We could not reach the server. Please check your connection and try again.')
      setState('error')
    }
  }

  // The success state replaces the form rather than sitting above it: leaving a
  // filled-in form on screen invites a second, identical send.
  if (state === 'sent') {
    return (
      <div className={cn('w-full rounded-ot-surface p-lg', BG[color])}>
        <p className="text-subhead font-semibold text-brand" role="status" {...epi.successMessage}>
          {successMessage}
        </p>
      </div>
    )
  }

  const bad = (f: string) => invalid.includes(f)

  return (
    <div className={cn('w-full rounded-ot-surface p-lg', BG[color])}>
      {heading && (
        <h2 className="text-headline font-bold leading-headline tracking-headline text-brand" {...epi.heading}>
          {heading}
        </h2>
      )}
      {intro && (
        <p className="mt-sm max-w-(--ot-measure) leading-body text-fg" {...epi.intro}>
          {intro}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate className="mt-lg flex flex-col gap-md">
        <div className={cn('grid gap-md', layout === 'compact' && 'sm:grid-cols-2')}>
          <div>
            <label htmlFor={`${id}-name`} className={LABEL} {...epi.nameLabel}>{nameLabel}</label>
            <input
              id={`${id}-name`} name="name" type="text" required
              autoComplete="name" className={FIELD}
              aria-invalid={bad('name')}
            />
          </div>
          <div>
            <label htmlFor={`${id}-email`} className={LABEL} {...epi.emailLabel}>{emailLabel}</label>
            <input
              id={`${id}-email`} name="email" type="email" required
              autoComplete="email" inputMode="email" className={FIELD}
              aria-invalid={bad('email')}
            />
          </div>
        </div>

        <div>
          <label htmlFor={`${id}-subject`} className={LABEL} {...epi.subjectLabel}>{subjectLabel}</label>
          <input id={`${id}-subject`} name="subject" type="text" className={FIELD} />
        </div>

        <div>
          <label htmlFor={`${id}-message`} className={LABEL} {...epi.messageLabel}>{messageLabel}</label>
          <textarea
            id={`${id}-message`} name="message" required rows={6}
            className={cn(FIELD, 'resize-y')}
            aria-invalid={bad('message')}
          />
        </div>

        {/* Honeypot. Hidden from people and from screen readers; bots fill it. */}
        <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
          <label htmlFor={`${id}-company`}>Company</label>
          <input id={`${id}-company`} name="company" type="text" tabIndex={-1} autoComplete="off" />
        </div>

        <label className="flex items-start gap-sm text-label leading-title text-fg-muted">
          <input
            name="consent" type="checkbox" required
            className="mt-[3px] h-4 w-4 shrink-0 accent-[var(--ot-brand)]"
            aria-invalid={bad('consent')}
          />
          <span {...epi.consentText}>{consentText}</span>
        </label>

        {error && (
          <p role="alert" className="text-label font-semibold text-accent">{error}</p>
        )}

        <div>
          <button
            type="submit"
            disabled={state === 'sending'}
            className={cn(
              'rounded-ot-control bg-brand px-lg py-sm text-body font-semibold text-fg-on-brand',
              'transition-colors duration-150 ease-quick hover:bg-brand-hover',
              'motion-reduce:transition-none',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            <span {...epi.submitLabel}>
              {state === 'sending' ? 'Sending…' : submitLabel}
            </span>
          </button>
        </div>
      </form>
    </div>
  )
}
