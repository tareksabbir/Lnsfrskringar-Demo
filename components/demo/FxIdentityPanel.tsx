'use client'

/**
 * The FX identity panel — a demo control surface inside the site menu.
 *
 * Shows who Feature Experimentation currently thinks this browser is, and lets
 * an operator change it: the four attributes declared in `lib/fx/identity.ts`,
 * plus the canonical visitor id with a button to mint a fresh one.
 *
 * Why the visitor id needs a button at all: the id is sticky for a year, and
 * bucketing is a pure function of it, so one browser sees one variation of an
 * experiment forever. That is correct behaviour and a demo-killer — the only way
 * to show the other arm used to be clearing cookies by hand in devtools. This
 * makes it one click.
 *
 * ── Why every change reloads the page ──────────────────────────────────────
 * Not laziness. The FX decision for a page is made during the server render
 * (resolveContentVariant), so a new attribute cannot change what is on screen
 * until the server renders again — and `router.refresh()` alone would not be
 * enough either, because the browser-side SDK builds its UserContext once per
 * tab and caches it. A full reload is the only thing that puts the server, the
 * browser SDK and ODP back in agreement, which is exactly what a demo needs to
 * be believable. It is also why the values live in a cookie rather than
 * sessionStorage; see lib/fx/identity.ts.
 */

import { useId, useState } from 'react'
import {
  FX_ATTRIBUTE_SPECS, FX_ATTRS_COOKIE, FX_COOKIE_MAX_AGE, FX_USER_ID_COOKIE,
  defaultFxAttributes, parseFxAttributes, serializeFxAttributes,
  type FxAttributeValue,
} from '@/lib/fx/identity'

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null
  const hit = document.cookie
    .split(';')
    .map(c => c.trim())
    .find(c => c.startsWith(`${name}=`))
  return hit ? hit.slice(name.length + 1) : null
}

function writeCookie(name: string, value: string): void {
  const secure = window.location.protocol === 'https:' ? '; Secure' : ''
  document.cookie = `${name}=${value}; Path=/; Max-Age=${FX_COOKIE_MAX_AGE}; SameSite=Lax${secure}`
}

export default function FxIdentityPanel() {
  // Read straight from document.cookie in lazy initialisers rather than in an
  // effect. Both call sites render this inside a portal that mounts only after
  // the client has, so there is no server pass to disagree with — and reading it
  // on first render avoids the frame where the panel shows defaults that are not
  // what FX is actually being sent. `readCookie` still guards on `document`, so
  // a server render would yield defaults rather than throwing.
  // No setter: the id only ever changes via regenerateId, which reloads the page,
  // so React state is never the thing that has to be updated.
  const [userId] = useState<string>(
    () => decodeURIComponent(readCookie(FX_USER_ID_COOKIE) ?? ''),
  )
  const [attrs, setAttrs] = useState<Record<string, FxAttributeValue>>(
    () => parseFxAttributes(readCookie(FX_ATTRS_COOKIE)),
  )
  const [dirty, setDirty] = useState(false)

  // Both MenuDrawer and MobileMenu render this, and both are in the DOM at once
  // (each is hidden by a breakpoint, not unmounted). Without a per-instance
  // prefix the two copies would share every id, and a <label for> would resolve
  // to whichever came first in the document — quite possibly the control inside
  // the menu that is currently hidden, leaving the visible one unlabelled.
  const uid = useId()
  const headingId = `${uid}-fx-identity`

  const set = (key: string, value: FxAttributeValue) => {
    setAttrs(prev => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  const apply = () => {
    writeCookie(FX_ATTRS_COOKIE, serializeFxAttributes(attrs))
    window.location.reload()
  }

  const reset = () => {
    writeCookie(FX_ATTRS_COOKIE, serializeFxAttributes(defaultFxAttributes()))
    window.location.reload()
  }

  const regenerateId = () => {
    // crypto.randomUUID needs a secure context; localhost counts, plain http on
    // a LAN address does not, and a demo does get shown off a laptop's IP.
    const fresh = window.crypto?.randomUUID
      ? window.crypto.randomUUID()
      : `anon-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`
    writeCookie(FX_USER_ID_COOKIE, fresh)
    window.location.reload()
  }

  const field = 'w-full rounded border border-fg/20 bg-canvas px-2 py-1.5 text-sm text-fg '
    + 'focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand'

  return (
    <section aria-labelledby={headingId} className="mt-xl border-t border-fg/10 pt-md">
      <h2 id={headingId} className="text-xl font-bold text-brand">
        Experimentation identity
      </h2>
      <p className="mt-1 text-xs leading-body text-fg-muted">
        Demo controls. These are sent to Feature Experimentation as the visitor id and
        user attributes, on the server and in the browser alike.
      </p>

      {/* ── Visitor id ──────────────────────────────────────────────────── */}
      <div className="mt-md rounded border border-fg/10 bg-surface p-3">
        <div className="flex items-baseline justify-between gap-sm">
          <span className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
            Visitor ID
          </span>
          <button
            type="button"
            onClick={regenerateId}
            className="shrink-0 rounded bg-brand px-2 py-1 text-xs font-semibold text-press-white
                       transition-colors duration-150 hover:bg-brand-hover
                       focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Generate new
          </button>
        </div>
        <code className="mt-1.5 block break-all font-mono text-xs text-fg">
          {userId || '— not set until the first page load —'}
        </code>
        <p className="mt-1.5 text-xs leading-body text-fg-muted">
          Bucketing is derived from this, so it is sticky for a year. Generate a new one to
          land in a different variation.
        </p>
      </div>

      {/* ── Attributes ──────────────────────────────────────────────────── */}
      <div className="mt-md flex flex-col gap-3">
        {FX_ATTRIBUTE_SPECS.map(spec => {
          const id = `${uid}-${spec.key}`
          const value = attrs[spec.key]

          return (
            <div key={spec.key}>
              <label htmlFor={id} className="block text-sm font-medium text-fg">
                {spec.label}
                <code className="ml-1.5 font-mono text-xs font-normal text-fg-muted">{spec.key}</code>
              </label>

              {spec.type === 'select' && (
                <select
                  id={id}
                  className={`mt-1 ${field}`}
                  value={String(value)}
                  onChange={e => set(spec.key, e.target.value)}
                >
                  {spec.options.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              )}

              {spec.type === 'number' && (
                <input
                  id={id}
                  type="number"
                  inputMode="numeric"
                  min={spec.min}
                  max={spec.max}
                  className={`mt-1 ${field}`}
                  value={String(value)}
                  onChange={e => set(spec.key, Number(e.target.value))}
                />
              )}

              {spec.type === 'boolean' && (
                <span className="mt-1 flex items-center gap-2">
                  <input
                    id={id}
                    type="checkbox"
                    checked={value === true}
                    onChange={e => set(spec.key, e.target.checked)}
                    className="h-4 w-4 accent-[var(--ot-brand)]"
                  />
                  <span className="text-sm text-fg">{value === true ? 'Yes' : 'No'}</span>
                </span>
              )}

              <p className="mt-1 text-xs leading-body text-fg-muted">{spec.description}</p>
            </div>
          )
        })}
      </div>

      <div className="mt-md flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={apply}
          disabled={!dirty}
          className="rounded bg-brand px-3 py-1.5 text-sm font-semibold text-press-white
                     transition-colors duration-150 hover:bg-brand-hover
                     disabled:cursor-not-allowed disabled:opacity-40
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {dirty ? 'Apply and reload' : 'Applied'}
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded border border-fg/20 px-3 py-1.5 text-sm text-fg
                     transition-colors duration-150 hover:border-brand hover:text-brand
                     focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Reset to defaults
        </button>
      </div>

      <p className="mt-2 text-xs leading-body text-fg-muted">
        Applying reloads the page: the decision is made during the server render, so nothing
        on screen can change until the server renders again.
      </p>
    </section>
  )
}
