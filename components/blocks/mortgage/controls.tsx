'use client'

/**
 * The form vocabulary of the mortgage calculator: seven controls that appear
 * over and over across its four sections.
 *
 * They live here rather than in the block because the block is long enough
 * already, and because every one of them carries accessibility wiring that is
 * easy to lose when it is inlined — a legend on each yes/no pair, a label bound
 * to each input, `aria-valuetext` on each slider so a screen reader hears
 * "3 825 000 kronor" instead of "3825000", and a radiogroup around the card
 * pickers so arrow keys move between them.
 *
 * Visually they follow Länsförsäkringar's own form styling: white cards on a
 * grey ground, brand-blue section titles over a 2px rule, bordered inputs with
 * the unit set inside on the right, and selection shown by a brand border plus
 * a tinted fill rather than by colour alone.
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { formatKr, parseKr } from './model'

// ── Layout ────────────────────────────────────────────────────────────────────

export function SectionCard({
  title,
  children,
  className,
}: {
  title: string
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('bg-canvas p-md md:p-lg', className)}>
      <h3 className="text-title font-semibold leading-title tracking-title text-brand">
        {title}
      </h3>
      <div className="mt-sm h-0.5 w-full bg-brand" />
      <div className="mt-md flex flex-col gap-md">{children}</div>
    </section>
  )
}

export function Field({
  label,
  help,
  htmlFor,
  children,
}: {
  label: string
  help?: string
  htmlFor?: string
  children: ReactNode
}) {
  return (
    <div>
      <label
        htmlFor={htmlFor}
        className="block text-body font-semibold leading-body text-fg"
      >
        {label}
      </label>
      <div className="mt-xs">{children}</div>
      {help && <p className="mt-xs text-label leading-body text-fg-muted">{help}</p>}
    </div>
  )
}

/** Same shape as `Field`, for controls that need a legend instead of a label. */
export function FieldSet({
  legend,
  help,
  children,
}: {
  legend: string
  help?: string
  children: ReactNode
}) {
  return (
    <fieldset>
      <legend className="text-body font-semibold leading-body text-fg">{legend}</legend>
      <div className="mt-xs">{children}</div>
      {help && <p className="mt-xs text-label leading-body text-fg-muted">{help}</p>}
    </fieldset>
  )
}

// ── Inputs ────────────────────────────────────────────────────────────────────

const inputClasses = [
  'w-full bg-canvas text-body text-fg tabular-nums',
  'rounded-input border border-fg/25 px-sm py-2 pr-10',
  'focus:border-brand focus:outline-2 focus:outline-offset-0 focus:outline-brand',
].join(' ')

/**
 * A money field: a text input that shows grouped thousands, plus an optional
 * slider bound to the same value.
 *
 * It is `inputMode="numeric"` on a text input rather than `type="number"`,
 * because a number input cannot hold "4 250 000" — and spinners on a price are
 * useless. Non-digits are dropped on the way in, so a pasted "4 250 000 kr"
 * still lands as 4250000.
 */
export function MoneyInput({
  id,
  value,
  onChange,
  min = 0,
  max,
  step = 50_000,
  slider = true,
  unit = 'kr',
  ariaLabel,
}: {
  id: string
  value: number
  onChange: (next: number) => void
  min?: number
  max?: number
  step?: number
  slider?: boolean
  unit?: string
  ariaLabel?: string
}) {
  return (
    <div>
      <div className="relative">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          className={inputClasses}
          value={value ? formatKr(value) : ''}
          onChange={e => onChange(parseKr(e.target.value))}
          aria-label={ariaLabel}
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-sm flex items-center text-body font-semibold text-fg-muted"
        >
          {unit}
        </span>
      </div>
      {slider && max !== undefined && (
        <input
          type="range"
          className="mt-xs w-full cursor-pointer accent-[var(--ot-brand)]"
          min={min}
          max={max}
          step={step}
          value={Math.min(Math.max(value, min), max)}
          onChange={e => onChange(Number(e.target.value))}
          aria-label={`${ariaLabel ?? 'Amount'} slider`}
          aria-valuetext={`${formatKr(value)} ${unit}`}
        />
      )}
    </div>
  )
}

export function SelectField({
  id,
  value,
  onChange,
  options,
  placeholder = 'Select',
}: {
  id: string
  value: string
  onChange: (next: string) => void
  options: readonly string[]
  placeholder?: string
}) {
  return (
    <select
      id={id}
      className={cn(inputClasses, 'cursor-pointer appearance-none bg-none pr-8')}
      value={value}
      onChange={e => onChange(e.target.value)}
    >
      <option value="">{placeholder}</option>
      {options.map(option => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  )
}

/** Yes / No, as the two buttons Länsförsäkringar uses rather than a checkbox. */
export function YesNo({
  value,
  onChange,
  name,
}: {
  value: boolean
  onChange: (next: boolean) => void
  name: string
}) {
  return (
    <div role="radiogroup" aria-label={name} className="flex gap-sm">
      {[
        { label: 'Yes', on: true },
        { label: 'No', on: false },
      ].map(option => {
        const selected = value === option.on
        return (
          <button
            key={option.label}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.on)}
            className={cn(
              'min-w-16 rounded-input border px-sm py-1.5 text-label font-semibold',
              'transition-colors duration-150 ease-quick cursor-pointer',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              selected
                ? 'border-brand bg-brand text-fg-on-brand'
                : 'border-fg/25 bg-canvas text-fg hover:border-brand',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/** Underlined tabs — the "One person / Two people" switch. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T
  onChange: (next: T) => void
  options: readonly { value: T; label: string }[]
  label: string
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex border-b border-fg/15">
      {options.map(option => {
        const selected = value === option.value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'relative -mb-px px-md py-2 text-body cursor-pointer',
              'transition-colors duration-150 ease-quick',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              selected
                ? 'border-b-2 border-brand font-semibold text-brand'
                : 'border-b-2 border-transparent text-fg-muted hover:text-fg',
            )}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export type CardOption<T extends string> = {
  value: T
  label: string
  icon: ReactNode
}

/**
 * The icon card pickers — "what are you here for?" and "what kind of home?".
 *
 * A real radio input sits in each card, visually intact rather than hidden, so
 * the dot in the corner is the browser's own control and the group behaves like
 * a radiogroup without any keyboard code of ours.
 */
export function ChoiceCards<T extends string>({
  name,
  value,
  onChange,
  options,
  columns = 3,
}: {
  name: string
  value: T
  onChange: (next: T) => void
  options: readonly CardOption<T>[]
  columns?: 3 | 4
}) {
  return (
    <div
      className={cn(
        'grid gap-sm',
        columns === 4 ? 'grid-cols-2 md:grid-cols-4' : 'grid-cols-3',
      )}
    >
      {options.map(option => {
        const selected = value === option.value
        return (
          <label
            key={option.value}
            className={cn(
              'group relative flex cursor-pointer flex-col items-center gap-xs',
              'rounded-input border px-xs py-sm text-center',
              'transition-[border-color,background-color] duration-150 ease-quick',
              'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand',
              selected
                ? 'border-brand bg-brand-tint'
                : 'border-fg/20 bg-canvas hover:border-brand/60',
            )}
          >
            <input
              type="radio"
              name={name}
              value={option.value}
              checked={selected}
              onChange={() => onChange(option.value)}
              className="absolute left-sm top-sm accent-[var(--ot-brand)]"
            />
            <span
              aria-hidden="true"
              className={cn(
                'mt-md flex h-8 items-end justify-center [&>svg]:h-8 [&>svg]:w-8 [&>svg]:stroke-[1.25]',
                selected ? 'text-brand' : 'text-brand/70',
              )}
            >
              {option.icon}
            </span>
            <span
              className={cn(
                'text-label font-semibold leading-body',
                selected ? 'text-brand' : 'text-fg',
              )}
            >
              {option.label}
            </span>
          </label>
        )
      })}
    </div>
  )
}

// ── Result panel parts ────────────────────────────────────────────────────────

/**
 * The scalloped edge under the headline figure — the one piece of decoration
 * Länsförsäkringar's panel carries, and the thing that makes the screenshot
 * recognisable. A repeating arc, drawn at 1px and tinted from the brand token.
 */
export function Scallop() {
  return (
    <svg
      aria-hidden="true"
      className="block h-2 w-full text-brand/35"
      viewBox="0 0 120 8"
      preserveAspectRatio="none"
      fill="none"
    >
      <defs>
        <pattern id="ot-scallop" width="8" height="8" patternUnits="userSpaceOnUse">
          <path d="M0 6 Q2 1 4 6 Q6 1 8 6" stroke="currentColor" strokeWidth="1" fill="none" />
        </pattern>
      </defs>
      <rect width="120" height="8" fill="url(#ot-scallop)" />
    </svg>
  )
}

/**
 * "Will I get the loan?" — a 180° arc with a needle.
 *
 * `usage` is the loan as a share of what the household's income alone would
 * support, so the needle sweeps left-to-right as the loan gets ambitious. With
 * no income there is nothing to point at: the arc greys out and the needle
 * rests at the left, which is exactly the state Länsförsäkringar's own panel
 * shows before you have filled anything in.
 */
export function Gauge({
  usage,
  verdict,
}: {
  usage: number
  verdict: 'likely' | 'possible' | 'unlikely' | 'unknown'
}) {
  const known = verdict !== 'unknown'
  // The arc runs to 115% of the income ceiling, so "over the limit" still has
  // somewhere to point instead of pinning silently at the end.
  const angle = known ? Math.min(usage / 1.15, 1) * 180 : 0
  const tone =
    verdict === 'likely'   ? 'text-brand'
    : verdict === 'possible' ? 'text-brand/60'
    : verdict === 'unlikely' ? 'text-accent'
    : 'text-fg/20'

  return (
    <div className="relative mx-auto w-40">
      <svg viewBox="0 0 100 56" className="w-full" role="img" aria-label={GAUGE_LABEL[verdict]}>
        <path
          d="M8 50 A42 42 0 0 1 92 50"
          className="text-fg/12"
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
        />
        {known && (
          <path
            d="M8 50 A42 42 0 0 1 92 50"
            className={cn(tone, 'motion-safe:transition-[stroke-dashoffset] motion-safe:duration-500 motion-safe:ease-smooth')}
            stroke="currentColor"
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={100}
            strokeDashoffset={100 - Math.min(usage / 1.15, 1) * 100}
          />
        )}
        <g
          className={cn(
            known ? tone : 'text-fg/40',
            'motion-safe:transition-transform motion-safe:duration-500 motion-safe:ease-kinetic',
          )}
          style={{ transform: `rotate(${angle}deg)`, transformOrigin: '50px 50px' }}
        >
          <line x1="50" y1="50" x2="14" y2="50" stroke="currentColor" strokeWidth="2" />
          <circle cx="14" cy="50" r="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </g>
        <circle cx="50" cy="50" r="3" className="text-brand" fill="currentColor" />
      </svg>
    </div>
  )
}

const GAUGE_LABEL: Record<'likely' | 'possible' | 'unlikely' | 'unknown', string> = {
  likely:   'Within what your income supports',
  possible: 'Close to what your income supports',
  unlikely: 'Above what your income supports',
  unknown:  'Not enough information yet',
}
