import { Check } from 'lucide-react'

/**
 * QuoteForm — the "get a price" panel from the LF product hero.
 *
 * PRESENTATIONAL ONLY, and deliberately so. One of the fields is a social
 * security number, so this must not collect or transmit anything:
 *
 *   - there is no <form> element, so there is nothing to submit and Enter does
 *     nothing;
 *   - the inputs carry no `name`, so even inside a form they would serialise
 *     nothing;
 *   - `autoComplete="off"` keeps the browser from storing or filling them;
 *   - the button is a link to a real quote journey, not a submit control.
 *
 * A GET form here would be actively harmful — the personal number would land in
 * a URL, in browser history and in every access log along the way. Wiring this
 * up for real needs a POST endpoint over TLS and a considered retention policy,
 * which is a backend decision rather than a block setting.
 */

export type QuoteFormField = {
  label: string
  placeholder?: string
  /** Small print under the field. Plain text — no markup. */
  help?: string
  /** Optional link under the field, e.g. a privacy notice. */
  linkLabel?: string
  linkUrl?: string
  /** Renders the Swedish plate badge inside the input. */
  platePrefix?: boolean
}

type Props = {
  fields: QuoteFormField[]
  ctaLabel?: string
  ctaUrl?: string
}

export default function QuoteForm({ fields, ctaLabel, ctaUrl }: Props) {
  if (!fields.length) return null

  return (
    <div className="rounded-ot-surface bg-brand-tint p-lg">
      <div className="grid gap-md sm:grid-cols-2">
        {fields.map((f, i) => {
          const id = `quote-field-${i}`
          return (
            <div key={f.label}>
              <label htmlFor={id} className="block text-body font-semibold text-fg">
                {f.label}
              </label>

              <div className="mt-xs flex items-center gap-sm border-b border-fg/25 bg-canvas px-sm py-2 focus-within:border-brand">
                {f.platePrefix && (
                  <span
                    aria-hidden="true"
                    className="flex h-6 w-5 flex-none flex-col items-center justify-end rounded-[2px] bg-brand pb-[2px] text-[9px] font-bold leading-none text-fg-on-brand"
                  >
                    S
                  </span>
                )}
                <input
                  id={id}
                  type="text"
                  placeholder={f.placeholder}
                  autoComplete="off"
                  className="w-full bg-transparent text-body text-fg outline-none placeholder:text-fg-muted/60"
                />
              </div>

              {f.linkLabel && (
                <a
                  href={f.linkUrl || '/'}
                  className="mt-xs inline-block text-label text-brand underline underline-offset-2 hover:text-brand-hover"
                >
                  {f.linkLabel}
                </a>
              )}
              {f.help && <p className="mt-xs text-label leading-title text-fg-muted">{f.help}</p>}
            </div>
          )
        })}
      </div>

      {ctaLabel && (
        <a
          href={ctaUrl || '/'}
          className="mt-lg inline-block rounded-ot-control bg-brand px-lg py-sm text-body font-semibold text-fg-on-brand transition-colors duration-150 ease-quick hover:bg-brand-hover motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {ctaLabel}
        </a>
      )}
    </div>
  )
}

/**
 * CheckList — the tick lines above the quote panel.
 *
 * A component rather than rich text: rich-text `ul` is hard-set to disc, so a
 * list with typed tick characters renders a bullet AND a tick on every row.
 */
export function CheckList({ items }: { items: string[] }) {
  if (!items.length) return null
  return (
    <ul className="flex flex-col gap-sm">
      {items.map((item, i) => (
        <li key={i} className="flex items-start gap-sm">
          <Check aria-hidden="true" className="mt-[0.2em] size-5 flex-none text-brand" strokeWidth={3} />
          <span className="leading-body text-fg">{item}</span>
        </li>
      ))}
    </ul>
  )
}
