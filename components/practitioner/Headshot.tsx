// Shared squared portrait used by the profile header, directory card, and list
// row. Sharp-cornered (the design system bans circular crops / rounded media),
// carries a chromatic brand bloom, and falls back to a deliberately-designed
// initials plate when no image is set. No hooks — safe in server and client trees.

type HeadshotVariant = 'header' | 'card' | 'row'

type Props = {
  src?:      string
  initials:  string
  alt:       string
  variant:   HeadshotVariant
  /** Spread preview attributes (header click-to-edit on the headshot field). */
  fieldAttrs?: Record<string, unknown>
}

const VARIANT: Record<HeadshotVariant, { frame: string; text: string; bloom: string }> = {
  // Tall editorial portrait on the brand panel.
  header: {
    frame: 'aspect-[4/5] w-full',
    text:  'text-[clamp(2.5rem,6vw,4rem)]',
    bloom: '0 16px 48px var(--ot-bloom-brand-faint), 0 4px 16px var(--ot-bloom-brand-faint)',
  },
  // Fills the top of a directory card.
  card: {
    frame: 'aspect-[4/5] w-full',
    text:  'text-[2.5rem]',
    bloom: '0 8px 28px var(--ot-bloom-brand-faint)',
  },
  // Compact fixed thumbnail in a list row.
  row: {
    frame: 'w-16 h-16 sm:w-18 sm:h-18',
    text:  'text-title',
    bloom: '0 4px 16px var(--ot-bloom-brand-faint)',
  },
}

export default function Headshot({ src, initials, alt, variant, fieldAttrs }: Props) {
  const v = VARIANT[variant]

  return (
    <div
      className={`relative ${v.frame} flex-none overflow-hidden bg-surface`}
      style={{
        boxShadow:  v.bloom,
        outline:    '1px solid var(--ot-bloom-brand-border)',
        outlineOffset: '0',
      }}
      {...fieldAttrs}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading={variant === 'header' ? undefined : 'lazy'}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div
          aria-hidden
          className={`absolute inset-0 flex items-center justify-center font-bold leading-none ${v.text}`}
          style={{
            // Dark canvas-tinted monogram tile: reads as an intentional plate on
            // every ground — including the header's brand panel, where a
            // brand-tinted fill would be brand-on-brand and disappear.
            background: 'linear-gradient(135deg, oklch(from var(--ot-canvas) calc(l + 0.05) c h), var(--ot-canvas))',
            color:      'var(--ot-brand)',
          }}
        >
          {initials || (
            // Last-resort glyph when there's not even a name (draft content).
            <svg viewBox="0 0 24 24" width="40%" height="40%" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
              <circle cx="12" cy="8" r="4" />
              <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          )}
        </div>
      )}
    </div>
  )
}
