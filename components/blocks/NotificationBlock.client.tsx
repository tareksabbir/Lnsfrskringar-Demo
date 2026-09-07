'use client'

import { useEffect, useRef, useState } from 'react'
import { ShieldAlert, X, ArrowRight } from 'lucide-react'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'
import { cn }            from '@/lib/utils'
import { ICON_REGISTRY } from '@/components/icons/iconRegistry'
import type { NotificationStyleOptions, NotificationTone } from '@/cms/styling/OT_NotificationBlock.styling'
import type { NotificationBlockProps } from './NotificationBlock'

// ─── Tone → token expressions ─────────────────────────────────────────────────
// Only the plate, the hairline and the tint carry the tone. Message and detail
// text stay on --ot-fg / --ot-fg-muted, which are the only pair guaranteed AA in
// both modes — an advisory is the last place to gamble on contrast.

const TONE_BASE: Record<NotificationTone, string> = {
  accent:  'var(--ot-accent)',
  brand:   'var(--ot-brand)',
  warning: 'var(--ot-intent-warning)',
  neutral: 'var(--ot-intent-neutral)',
}

const TONE_ON: Record<NotificationTone, string> = {
  accent:  'var(--ot-fg-on-accent)',
  brand:   'var(--ot-fg-on-brand)',
  warning: 'oklch(from var(--ot-intent-warning) 25% c h)',
  neutral: 'oklch(from var(--ot-intent-neutral) 22% c h)',
}

function alpha(tone: NotificationTone, a: number): string {
  return `oklch(from ${TONE_BASE[tone]} l c h / ${a})`
}

type DismissPhase = 'visible' | 'sweeping' | 'collapsing' | 'gone'

export default function NotificationBlockClient({
  heading,
  label,
  body,
  ctaLabel,
  ctaUrl,
  epi = {},
  styleOptions = {},
}: NotificationBlockProps) {
  const {
    tone        = 'accent',
    frame       = 'plate',
    layout      = 'band',
    density     = 'default',
    dismissible = false,
    icon        = 'none',
  } = styleOptions as NotificationStyleOptions

  const reducedMotion = usePrefersReducedMotion()
  const [phase, setPhase] = useState<DismissPhase>('visible')
  const [drawn, setDrawn] = useState(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])

  // The hairline draws itself once on mount — a transform, so no layout work.
  useEffect(() => { setDrawn(true) }, [])
  useEffect(() => () => { timersRef.current.forEach(clearTimeout) }, [])

  function handleDismiss() {
    if (reducedMotion) { setPhase('gone'); return }
    setPhase('sweeping')
    timersRef.current = [
      setTimeout(() => setPhase('collapsing'), 200),
      setTimeout(() => setPhase('gone'),       480),
    ]
  }

  if (phase === 'gone') return null

  const IconComp  = (icon && icon !== 'none' ? ICON_REGISTRY[icon] : null) ?? ShieldAlert
  const isStacked = layout === 'stacked'
  const isCompact = density === 'compact'
  const plateSize = isCompact ? 36 : 44

  // ── Icon frame ────────────────────────────────────────────────────────────
  // Plate: tone fill with a 45° hatch, the way a printed hazard notice is set.
  // Ring: hairline circle, icon in the tone colour — the quieter of the two.
  const plateStyle: React.CSSProperties = frame === 'plate'
    ? {
        width: plateSize, height: plateSize,
        background: TONE_BASE[tone],
        backgroundImage:
          'repeating-linear-gradient(45deg, oklch(100% 0 0 / 0.16) 0 2px, transparent 2px 6px)',
        color: TONE_ON[tone],
      }
    : {
        width: plateSize, height: plateSize,
        border: `1px solid ${alpha(tone, 0.45)}`,
        color:  TONE_BASE[tone],
      }

  const iconFrame = (
    <div
      className={cn(
        'shrink-0 flex items-center justify-center',
        frame === 'plate' ? 'rounded-ot-control' : 'rounded-full',
      )}
      style={plateStyle}
    >
      <IconComp size={isCompact ? 18 : 22} strokeWidth={1.75} aria-hidden />
    </div>
  )

  // ── Hairline that trails the label ────────────────────────────────────────
  const hairline = (
    <span
      aria-hidden
      className="h-px flex-1 origin-left"
      style={{
        background: alpha(tone, 0.32),
        transform:  drawn || reducedMotion ? 'scaleX(1)' : 'scaleX(0)',
        transition: reducedMotion ? undefined : 'transform 620ms var(--ot-ease-kinetic)',
      }}
    />
  )

  const ctaEl = ctaLabel && ctaUrl ? (
    <a
      href={ctaUrl}
      className={cn(
        'group inline-flex items-center gap-xs text-label font-semibold text-fg',
        'underline-offset-4 hover:underline focus-visible:outline-none',
        'focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 rounded-ot-control',
      )}
      style={{ textDecorationColor: alpha(tone, 0.6) }}
    >
      <span {...epi.ctaLabel}>{ctaLabel}</span>
      <ArrowRight
        size={13}
        strokeWidth={2}
        aria-hidden
        className="transition-transform group-hover:translate-x-0.5"
        style={{ color: TONE_BASE[tone] }}
      />
    </a>
  ) : null

  const dismissBtn = dismissible ? (
    <button
      type="button"
      onClick={handleDismiss}
      aria-label="Dismiss notification"
      style={{ borderColor: alpha(tone, 0.35) }}
      className={cn(
        'shrink-0 size-7 rounded-ot-control border flex items-center justify-center cursor-pointer',
        'text-fg-muted transition-colors hover:bg-fg/5 hover:text-fg',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
      )}
    >
      <X size={14} strokeWidth={2} aria-hidden />
    </button>
  ) : null

  const text = (
    <div className={cn('flex-1 min-w-0 flex flex-col gap-xs', isStacked && 'items-center text-center')}>
      {label && (
        <div className={cn('flex items-center gap-sm w-full', isStacked && 'justify-center')}>
          <span
            className="text-label uppercase tracking-label font-semibold text-fg-muted shrink-0"
            {...epi.label}
          >
            {label}
          </span>
          {!isStacked && hairline}
        </div>
      )}
      <p
        className={cn(
          'font-semibold text-fg text-pretty leading-snug',
          isCompact ? 'text-body' : 'text-title tracking-title',
        )}
        {...epi.heading}
      >
        {heading}
      </p>
      {body && (
        <p className="text-body leading-body text-fg-muted text-pretty max-w-[68ch]" {...epi.body}>
          {body}
        </p>
      )}
      {ctaEl && <div className="mt-xs">{ctaEl}</div>}
    </div>
  )

  const notice = (
    <div
      // An advisory that is present on load is not an interruption, so it
      // announces politely rather than assertively.
      role="status"
      className={cn(
        'w-full flex rounded-ot-surface border',
        isCompact ? 'px-md py-sm gap-sm' : 'px-md py-md gap-md',
        isStacked ? 'flex-col items-center' : 'items-start',
      )}
      style={{ background: alpha(tone, 0.07), borderColor: alpha(tone, 0.28) }}
    >
      {iconFrame}
      {text}
      {dismissBtn}
    </div>
  )

  if (!dismissible) return notice

  // Two-phase exit, matching CalloutBlock: content sweeps and fades, then the
  // row height collapses via grid-template-rows.
  return (
    <div
      style={{
        display:          'grid',
        gridTemplateRows: phase === 'collapsing' ? '0fr' : '1fr',
        overflow:         'hidden',
        ...(phase === 'collapsing' && {
          transition: 'grid-template-rows 260ms cubic-bezier(0.25, 1, 0.5, 1)',
        }),
      }}
    >
      <div style={{ minHeight: 0 }}>
        <div
          style={phase === 'sweeping' ? {
            opacity:    0,
            transform:  'translateX(1.25rem)',
            transition: 'opacity 200ms cubic-bezier(0.25, 1, 0.5, 1), transform 200ms cubic-bezier(0.25, 1, 0.5, 1)',
          } : undefined}
        >
          {notice}
        </div>
      </div>
    </div>
  )
}
