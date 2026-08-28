// Portrait surface shared by the directory card (full-bleed 3:4) and list row
// (circular thumbnail). Renders the headshot when present, otherwise a designed
// branded-abstract plate: a brand-derived radial gradient + a faint grain field
// + monumental initials. The gradient uses OKLCH relative-color syntax off
// --ot-brand, so it recalibrates under a CMS theme override like every other
// token. No hooks — safe in server and client trees.

type PortraitShape = 'fill' | 'circle'

type Props = {
  src?:      string
  initials:  string
  alt:       string
  /** 'fill' → absolute inset portrait that fills its (aspect-ratio'd) parent.
   *  'circle' → self-sized circular thumbnail; pass size via `className`. */
  shape:     PortraitShape
  /** Sizing / extra classes (e.g. `w-14 h-14` for the circular row thumbnail). */
  className?: string
}

// SVG feTurbulence grain, desaturated, tiled. Matches the CardBlock noise field
// so the two surfaces share one grain character. mix-blend-overlay keeps it from
// darkening or lightening the gradient beneath.
const NOISE_BG =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)'/%3E%3C/svg%3E\")"

// Atmospheric brand portrait surface for the no-headshot state. Light-shifted
// highlight at upper-left falling to a deeper brand at the lower-right corner.
const GRADIENT =
  'radial-gradient(ellipse at 40% 35%, ' +
  'oklch(from var(--ot-brand) calc(l + 0.12) c h) 0%, ' +
  'var(--ot-brand) 40%, ' +
  'oklch(from var(--ot-brand) calc(l - 0.1) c h) 100%)'

export default function PractitionerPortrait({ src, initials, alt, shape, className = '' }: Props) {
  const isCircle = shape === 'circle'

  // The fill portrait establishes a container so the initials can scale to the
  // card width via cqw; the circle uses a fixed type scale instead.
  const wrapper = isCircle
    ? `relative flex-none overflow-hidden rounded-full ${className}`
    : `absolute inset-0 h-full w-full overflow-hidden @container ${className}`

  const initialsSize = isCircle
    ? 'text-base sm:text-lg'
    : 'text-[clamp(2.5rem,8cqw,4rem)]'

  return (
    <div className={wrapper}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className={
            'absolute inset-0 h-full w-full object-cover' +
            // Slow editorial zoom on card hover; never on the small circle.
            (isCircle ? '' : ' motion-safe:transition-transform motion-safe:duration-700 motion-safe:ease-[var(--ot-ease-kinetic)] group-hover:scale-[1.04]')
          }
        />
      ) : (
        <div aria-hidden className="absolute inset-0" style={{ background: GRADIENT }}>
          {/* Grain field — adds material texture so the plate reads as designed,
              not as a flat fallback. */}
          <div
            className="pointer-events-none absolute inset-0 mix-blend-overlay opacity-[0.12]"
            style={{ backgroundImage: NOISE_BG }}
          />
          <div
            className={`absolute inset-0 flex items-center justify-center font-extrabold leading-none tracking-[-0.03em] ${initialsSize}`}
            style={{ color: 'oklch(from var(--ot-fg-on-brand) l c h / 0.90)' }}
          >
            {initials || (
              <svg viewBox="0 0 24 24" width="36%" height="36%" fill="none" stroke="currentColor" strokeWidth={1.5} aria-hidden>
                <circle cx="12" cy="8" r="4" />
                <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
