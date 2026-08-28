import type { Metadata } from 'next'
import { notFound }       from 'next/navigation'
import { SectionLabel }   from '../../components'
import SliderRow          from '@/cms/compositions/SliderRow'

// ─── Static params ────────────────────────────────────────────────────────────

const FEATURE_SLUGS = ['row-rhythm', 'section-overlap', 'carousel', 'row-settings', 'section-settings'] as const
type FeatureSlug    = typeof FEATURE_SLUGS[number]

const LABELS: Record<FeatureSlug, string> = {
  'row-rhythm':       'Row Rhythm',
  'section-overlap':  'Section Overlap',
  'carousel':         'Carousel',
  'row-settings':     'Row Settings',
  'section-settings': 'Section Settings',
}

export function generateStaticParams() {
  return FEATURE_SLUGS.map(feature => ({ feature }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ feature: string }>
}): Promise<Metadata> {
  const { feature } = await params
  const label = LABELS[feature as FeatureSlug]
  if (!label) return {}
  return { title: `${label} — Layout — Showcase — Site Accelerator` }
}

// ─── Demo primitives ──────────────────────────────────────────────────────────

type RhythmLevel = 'gentle' | 'moderate' | 'bold'
type ColVariant  = 'brand' | 'surface' | 'accent'

const LEVEL_OFFSETS: Record<RhythmLevel, string[]> = {
  gentle:   ['0',     '8px',  '16px', '32px'],
  moderate: ['0',    '16px',  '32px', '64px'],
  bold:     ['0',    '32px',  '64px', '128px'],
}

const COL_VARIANTS: ColVariant[] = ['brand', 'surface', 'accent']

function colBg(v: ColVariant) {
  if (v === 'brand')   return 'bg-brand'
  if (v === 'surface') return 'bg-surface border border-fg/10'
  return 'bg-accent'
}

function colFg(v: ColVariant) {
  if (v === 'brand')   return 'text-fg-on-brand'
  if (v === 'surface') return 'text-fg'
  return 'text-fg-on-accent'
}

function ColPlaceholder({
  index,
  variant,
  label,
}: {
  index: number
  variant: ColVariant
  label: string
}) {
  return (
    <div
      className={`flex-1 min-w-0 flex flex-col gap-sm p-md ${colBg(variant)}`}
      style={{ minHeight: '9rem' }}
    >
      <span className={`text-label tracking-label uppercase font-semibold ${colFg(variant)} opacity-60`}>
        Column {index}
      </span>
      <p className={`text-title font-semibold leading-title ${colFg(variant)}`}>
        {label}
      </p>
    </div>
  )
}

function RhythmDemo({ level }: { level: RhythmLevel }) {
  const offsets = LEVEL_OFFSETS[level]
  const cols    = ['Editorial lead', 'Supporting voice', 'Third perspective', 'Trailing note']

  return (
    <div className="space-y-xl">
      {/* 3-column row */}
      <div>
        <p className="text-label tracking-label uppercase text-fg-muted font-semibold mb-md">
          3 columns — offsets 0 / {offsets[1]} / {offsets[2]}
        </p>
        <div
          className="flex flex-col md:flex-row gap-md"
          data-rhythm={level}
          data-bp="md"
        >
          <ColPlaceholder index={1} variant="brand"   label={cols[0]} />
          <ColPlaceholder index={2} variant="surface" label={cols[1]} />
          <ColPlaceholder index={3} variant="accent"  label={cols[2]} />
        </div>
      </div>

      {/* 4-column row */}
      <div>
        <p className="text-label tracking-label uppercase text-fg-muted font-semibold mb-md">
          4 columns — offsets 0 / {offsets[1]} / {offsets[2]} / {offsets[3]}
        </p>
        <div
          className="flex flex-col md:flex-row gap-md"
          data-rhythm={level}
          data-bp="md"
        >
          <ColPlaceholder index={1} variant="brand"   label={cols[0]} />
          <ColPlaceholder index={2} variant="surface" label={cols[1]} />
          <ColPlaceholder index={3} variant="accent"  label={cols[2]} />
          <ColPlaceholder index={4} variant="surface" label={cols[3]} />
        </div>
      </div>
    </div>
  )
}

function NudgeDemo() {
  return (
    <div>
      <p className="text-label tracking-label uppercase text-fg-muted font-semibold mb-md">
        Moderate cascade — col 2 nudged +lg (32px extra), col 3 nudged −md (16px back)
      </p>
      <div
        className="flex flex-col md:flex-row gap-md"
        data-rhythm="moderate"
        data-bp="md"
      >
        {/* col 1: no nudge, offset = 0 */}
        <div className="flex-1 min-w-0 flex flex-col gap-sm p-md bg-brand" style={{ minHeight: '9rem' }}>
          <span className="text-label tracking-label uppercase font-semibold text-fg-on-brand opacity-60">Column 1</span>
          <p className="text-title font-semibold leading-title text-fg-on-brand">No nudge</p>
          <code className="text-label font-mono text-fg-on-brand opacity-50">offset: 0</code>
        </div>
        {/* col 2: nudge +lg → offset md + lg = 48px */}
        <div className="flex-1 min-w-0 flex flex-col gap-sm p-md bg-surface border border-fg/10" data-nudge="down_lg" style={{ minHeight: '9rem' }}>
          <span className="text-label tracking-label uppercase font-semibold text-fg opacity-60">Column 2</span>
          <p className="text-title font-semibold leading-title text-fg">Nudge + lg</p>
          <code className="text-label font-mono text-fg-muted">offset: md + lg</code>
        </div>
        {/* col 3: nudge up_md → offset lg - md = 16px */}
        <div className="flex-1 min-w-0 flex flex-col gap-sm p-md bg-accent" data-nudge="up_md" style={{ minHeight: '9rem' }}>
          <span className="text-label tracking-label uppercase font-semibold text-fg-on-accent opacity-60">Column 3</span>
          <p className="text-title font-semibold leading-title text-fg-on-accent">Nudge −md</p>
          <code className="text-label font-mono text-fg-on-accent opacity-60">offset: lg − md</code>
        </div>
      </div>
    </div>
  )
}

// ─── Row Rhythm showcase ───────────────────────────────────────────────────────

function RowRhythmShowcase() {
  return (
    <div className="space-y-2xl">

      {/* Intro */}
      <div className="max-w-[640px]">
        <p className="text-body leading-body text-fg-muted">
          A Row-level display setting that applies deliberate staircase offsets to child
          columns — an editorial cascade where the eye steps down the page as it scans
          left to right. Three levels map to the spacing token scale. Offsets are static
          transforms that zero out when columns stack below the row's breakpoint.
          When paired with a slide-up entrance animation, the offset becomes the resting
          position the animation settles into.
        </p>
      </div>

      <div className="space-y-md">
        <p className="text-label tracking-label uppercase text-fg-muted font-semibold">
          Setting: <code className="font-mono normal-case text-fg">columnRhythm</code>
          {' '}on OT_LandingRow display template
        </p>
        <p className="text-label tracking-label uppercase text-fg-muted font-semibold">
          Escape hatch: <code className="font-mono normal-case text-fg">columnRhythmNudge</code>
          {' '}on OT_LandingColumn — adds or subtracts from the base offset per column
        </p>
      </div>

      {/* Gentle */}
      <div>
        <SectionLabel index="01" title="Gentle cascade" />
        <div className="mb-md">
          <p className="text-body text-fg-muted">
            Step size: sm / md / lg (8 / 16 / 32px). For rows where content is closely
            related and the cascade should feel like breathing room rather than drama.
          </p>
        </div>
        <RhythmDemo level="gentle" />
      </div>

      {/* Moderate */}
      <div>
        <SectionLabel index="02" title="Moderate cascade" />
        <div className="mb-md">
          <p className="text-body text-fg-muted">
            Step size: md / lg / xl (16 / 32 / 64px). The primary editorial choice —
            pronounced enough to read as intentional composition, measured enough to keep
            content in easy scanning range.
          </p>
        </div>
        <RhythmDemo level="moderate" />
      </div>

      {/* Bold */}
      <div>
        <SectionLabel index="03" title="Bold cascade" />
        <div className="mb-md">
          <p className="text-body text-fg-muted">
            Step size: lg / xl / 2xl (32 / 64 / 128px). Magazine-spread intensity.
            Each column occupies a distinct vertical register. Reserve for hero-style
            rows with short content blocks; add extra row bottom padding to prevent
            overflow on the deepest column.
          </p>
        </div>
        <RhythmDemo level="bold" />
      </div>

      {/* Nudge escape hatch */}
      <div>
        <SectionLabel index="04" title="Per-column nudge" />
        <div className="mb-md">
          <p className="text-body text-fg-muted">
            The <code className="font-mono text-fg">columnRhythmNudge</code> setting on
            OT_LandingColumn adds or subtracts one spacing step from a column's base
            rhythm offset. Useful for asymmetric compositions where one column should
            break the regular staircase — a portrait image that reads better slightly
            raised, or a stat block that anchors lower than its neighbors.
          </p>
        </div>
        <NudgeDemo />
      </div>

      {/* Token reference */}
      <div>
        <SectionLabel index="05" title="Token reference" />
        <div className="bg-surface p-lg space-y-md font-mono text-label text-fg-muted">
          <p className="text-title font-semibold text-fg mb-md">CSS custom properties</p>
          <div className="space-y-sm">
            <div className="flex gap-xl">
              <span className="text-fg w-[220px] flex-none">--ot-rhythm-offset</span>
              <span>Per-column base offset (set by row rhythm + nth-child). Default 0px.</span>
            </div>
            <div className="flex gap-xl">
              <span className="text-fg w-[220px] flex-none">--ot-rhythm-nudge</span>
              <span>Per-column correction (set by columnRhythmNudge). Default 0px.</span>
            </div>
          </div>
          <p className="text-title font-semibold text-fg mt-lg mb-md">Ramp values</p>
          <div className="grid grid-cols-4 gap-md text-center">
            {[
              { level: 'gentle',   c2: 'sm (8px)',   c3: 'md (16px)',   c4: 'lg (32px)'   },
              { level: 'moderate', c2: 'md (16px)',  c3: 'lg (32px)',   c4: 'xl (64px)'   },
              { level: 'bold',     c2: 'lg (32px)',  c3: 'xl (64px)',   c4: '2xl (128px)' },
            ].map(r => (
              <div key={r.level} className="col-span-4 grid grid-cols-4 gap-md items-baseline">
                <span className="text-fg text-left">{r.level}</span>
                <span>col1 → 0</span>
                <span>col2 → {r.c2}</span>
                <span>col3 → {r.c3}</span>
              </div>
            ))}
          </div>
          <p className="mt-sm text-fg-muted">col4 and beyond: one step above col3 (capped at 2xl for bold)</p>
        </div>
      </div>

    </div>
  )
}

// ─── Section Overlap showcase ─────────────────────────────────────────────────

type OverlapLevel = 'shallow' | 'mid' | 'deep' | 'full'

const OVERLAP_LEVELS: { level: OverlapLevel; token: string; px: string; label: string; desc: string }[] = [
  { level: 'shallow', token: 'md',  px: '16px',  label: 'Shallow', desc: 'Barely a tuck — the seam clips together. Works best when a subtle shift in background is enough to signal depth.' },
  { level: 'mid',     token: 'lg',  px: '32px',  label: 'Mid',     desc: 'The primary editorial choice. Clear interlock without drama — the upper section\'s background is visibly encroached.' },
  { level: 'deep',    token: 'xl',  px: '64px',  label: 'Deep',    desc: 'Dramatic fold-over. Use for immersive hero-to-content transitions where the lower section asserts strong presence.' },
  { level: 'full',    token: '2xl', px: '128px', label: 'Full',    desc: 'Maximum pull. The lower section consumes a full 128px of the one above. Reserve for poster-scale moments.' },
]

function OverlapPair({ level, token, px, label, desc }: typeof OVERLAP_LEVELS[number]) {
  return (
    <div>
      <p className="text-label tracking-label uppercase text-fg-muted font-semibold mb-md">
        {label} — <code className="font-mono normal-case text-fg">--ot-space-{token}</code> ({px})
      </p>
      <div className="relative overflow-visible">
        {/* Section above — canvas ground, simulates the preceding section */}
        <div className="bg-canvas border border-fg/10 flex flex-col" style={{ minHeight: '7rem', padding: '2rem' }}>
          <span className="text-label tracking-label uppercase text-fg-muted font-semibold opacity-60">Section above</span>
          <p className="text-title font-semibold text-fg mt-sm">The preceding section ends here</p>
        </div>
        {/* Overlapping section — surface background pulls up */}
        <div
          className="bg-surface border border-fg/10 flex flex-col"
          data-overlap={level}
          style={{ minHeight: '6rem', padding: '2rem' }}
        >
          <span className="text-label tracking-label uppercase text-fg-muted font-semibold opacity-60">
            Overlapping section — {label.toLowerCase()} ({px})
          </span>
          <p className="text-body text-fg-muted mt-sm">{desc}</p>
        </div>
      </div>
    </div>
  )
}

function ColumnBleedDemo() {
  return (
    <div>
      <p className="text-label tracking-label uppercase text-fg-muted font-semibold mb-md">
        Column bleed right — <code className="font-mono normal-case text-fg">--ot-space-lg</code> (32px)
      </p>
      <div className="flex gap-md overflow-visible" data-bp="md">
        {/* Left column — brand fill, bleeds right */}
        <div
          className="flex-1 min-w-0 bg-brand flex flex-col justify-between"
          data-col-bleed="right"
          style={{ minHeight: '10rem', padding: '2rem' }}
        >
          <span className="text-label tracking-label uppercase text-fg-on-brand font-semibold opacity-70">Column 1</span>
          <p className="text-title font-semibold text-fg-on-brand">This column bleeds 32px into the right neighbor</p>
        </div>
        {/* Right column — surface, partially overlapped */}
        <div
          className="flex-1 min-w-0 bg-surface border border-fg/10 flex flex-col justify-center"
          style={{ minHeight: '10rem', padding: '2rem' }}
        >
          <span className="text-label tracking-label uppercase text-fg-muted font-semibold opacity-70">Column 2</span>
          <p className="text-body text-fg-muted mt-sm">
            The brand column's background overlaps 32px into this column's left edge.
            Use for image-to-text pairings where the visual panel dominates.
          </p>
        </div>
      </div>
    </div>
  )
}

function SectionOverlapShowcase() {
  return (
    <div className="space-y-2xl">

      {/* Intro */}
      <div className="max-w-[640px]">
        <p className="text-body leading-body text-fg-muted">
          A Section-level display setting that pulls the section up into the one above it
          via negative margin-top — seams that interlock rather than bands that stack flush.
          The section's background intrudes upward; content inside stays padded as authored.
          Requires the overlapping section to have its own background.
        </p>
      </div>

      <div className="space-y-md">
        <p className="text-label tracking-label uppercase text-fg-muted font-semibold">
          Setting: <code className="font-mono normal-case text-fg">sectionOverlap</code>
          {' '}on OT_LandingSection display template
        </p>
        <p className="text-label tracking-label uppercase text-fg-muted font-semibold">
          Dependency: set <code className="font-mono normal-case text-fg">backgroundColor</code>{' '}
          on the overlapping section. A transparent section produces no visible seam.
        </p>
        <p className="text-label tracking-label uppercase text-fg-muted font-semibold">
          Mobile: overlap zeroes out below 640px — sections stack flush on narrow viewports.
        </p>
      </div>

      {/* Four overlap levels */}
      {OVERLAP_LEVELS.map(o => (
        <div key={o.level}>
          <SectionLabel index={({ shallow: '01', mid: '02', deep: '03', full: '04' } as const)[o.level]} title={`${o.label} overlap`} />
          <OverlapPair {...o} />
        </div>
      ))}

      {/* Column bleed */}
      <div>
        <SectionLabel index="05" title="Column bleed" />
        <div className="mb-md max-w-[640px]">
          <p className="text-body text-fg-muted">
            A Column-level variant controlled by{' '}
            <code className="font-mono text-fg">columnBleed</code>{' '}
            on OT_LandingColumn. Extends one column's content area 32px into its neighbor's
            space via negative margin. The bleeding column sits on top (z-index 1). Use
            for image-to-text pairings, stat panels asserting dominance, or any moment
            where a column should break its own boundary.
          </p>
        </div>
        <ColumnBleedDemo />
      </div>

      {/* Token reference */}
      <div>
        <SectionLabel index="06" title="Token reference" />
        <div className="bg-surface p-lg space-y-md font-mono text-label text-fg-muted">
          <p className="text-title font-semibold text-fg mb-md">Overlap amounts</p>
          <div className="space-y-sm">
            {OVERLAP_LEVELS.map(o => (
              <div key={o.level} className="flex gap-xl">
                <span className="text-fg w-[100px] flex-none">{o.level}</span>
                <span className="w-[160px] flex-none">--ot-space-{o.token} ({o.px})</span>
                <span>margin-top: calc(-1 * {o.px})</span>
              </div>
            ))}
          </div>
          <p className="text-title font-semibold text-fg mt-lg mb-md">Column bleed</p>
          <div className="space-y-sm">
            <div className="flex gap-xl">
              <span className="text-fg w-[100px] flex-none">right</span>
              <span className="w-[160px] flex-none">--ot-space-lg (32px)</span>
              <span>margin-right: −32px · z-index 1</span>
            </div>
            <div className="flex gap-xl">
              <span className="text-fg w-[100px] flex-none">left</span>
              <span className="w-[160px] flex-none">--ot-space-lg (32px)</span>
              <span>margin-left: −32px · z-index 1</span>
            </div>
          </div>
          <p className="mt-md text-fg-muted">
            Stacking: position relative + z-index 1 on the overlapping element.
            Multiple overlapping sections resolve via DOM order — later in DOM = higher stack.
          </p>
        </div>
      </div>

    </div>
  )
}

// ─── Carousel showcase ────────────────────────────────────────────────────────

const SLIDE_CONTENT = [
  { bg: 'bg-brand',                       fg: 'text-fg-on-brand',   heading: 'Enterprise-grade infrastructure',  sub: 'Capacity that scales with demand'       },
  { bg: 'bg-surface border border-fg/10', fg: 'text-fg',            heading: 'Uncompromised security posture',   sub: 'Built to the strictest standards'       },
  { bg: 'bg-accent',                      fg: 'text-fg-on-accent',  heading: 'Insight across every workflow',    sub: 'Real-time observability, built in'      },
]

function Slide({ bg, fg, heading, sub, n }: { bg: string; fg: string; heading: string; sub: string; n: number }) {
  return (
    <div className={`flex flex-col gap-md p-xl ${bg}`} style={{ minHeight: '13rem' }}>
      <span className={`text-label tracking-label uppercase font-semibold ${fg} opacity-50`}>0{n}</span>
      <p className={`text-headline font-bold leading-headline tracking-headline ${fg}`}>{heading}</p>
      <p className={`text-body ${fg} opacity-70`}>{sub}</p>
    </div>
  )
}

const TRANSITION_DEMOS: { mode: string; label: string; desc: string }[] = [
  { mode: 'slide',  label: 'Slide',  desc: 'Classic horizontal translate — all slides live on a single track that shifts left.' },
  { mode: 'fade',   label: 'Fade',   desc: 'Slides stack in place; active fades in while the previous fades out. Good for full-bleed image backgrounds.' },
  { mode: 'cover',  label: 'Cover',  desc: 'Like slide, but inactive slides scale down and dim — the active slide asserts dominance.' },
  { mode: 'morph',  label: 'Morph',  desc: 'Fade with a blur-and-scale effect. Creates an organic, editorial handoff between slides.' },
]

function CarouselShowcase() {
  return (
    <div className="space-y-2xl">

      <div className="max-w-[640px]">
        <p className="text-body leading-body text-fg-muted">
          The OT_LandingRowSlider display template renders a client-side carousel
          in place of a standard row. Four transition modes, configurable controls,
          autoplay, loop behavior, and a peek inset to tease adjacent slides.
        </p>
      </div>

      <div className="space-y-sm">
        <p className="text-label tracking-label uppercase text-fg-muted font-semibold">
          Template: <code className="font-mono normal-case text-fg">OT_LandingRowSlider</code>
        </p>
        <p className="text-label tracking-label uppercase text-fg-muted font-semibold">
          Component: <code className="font-mono normal-case text-fg">SliderRow</code> (client component)
        </p>
      </div>

      {/* Transition modes — 2×2 grid */}
      <div>
        <SectionLabel index="01" title="Transition modes" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-xl">
          {TRANSITION_DEMOS.map(({ mode, label, desc }) => (
            <div key={mode} className="space-y-md">
              <div>
                <p className="text-title font-semibold text-fg">{label}</p>
                <p className="text-label text-fg-muted mt-xs">{desc}</p>
              </div>
              <SliderRow
                transition={mode}
                controls="both"
                autoplay="off"
                loop="loop"
                peek="none"
                verticalPadding=""
                bgColorClass=""
              >
                {SLIDE_CONTENT.map((s, i) => (
                  <Slide key={i} n={i + 1} {...s} />
                ))}
              </SliderRow>
            </div>
          ))}
        </div>
      </div>

      {/* Peek inset */}
      <div>
        <SectionLabel index="02" title="Peek — tease adjacent slides" />
        <div className="max-w-[640px] mb-lg">
          <p className="text-body text-fg-muted">
            The <code className="font-mono text-fg">peek</code> setting adds symmetric horizontal inset,
            trimming each side so neighboring slides bleed into view. Three sizes: sm (4%), md (8%), lg (14%).
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-xl">
          {(['sm', 'md', 'lg'] as const).map(size => (
            <div key={size} className="space-y-md">
              <p className="text-label tracking-label uppercase text-fg-muted font-semibold">
                Peek {size} — {size === 'sm' ? '4%' : size === 'md' ? '8%' : '14%'} inset
              </p>
              <SliderRow
                transition="slide"
                controls="dots"
                autoplay="off"
                loop="loop"
                peek={size}
                verticalPadding=""
                bgColorClass=""
              >
                {SLIDE_CONTENT.map((s, i) => (
                  <Slide key={i} n={i + 1} {...s} />
                ))}
              </SliderRow>
            </div>
          ))}
        </div>
      </div>

      {/* Controls variants */}
      <div>
        <SectionLabel index="03" title="Controls" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-xl">
          {([
            { controls: 'both',   label: 'Both — arrows + dots' },
            { controls: 'arrows', label: 'Arrows only' },
            { controls: 'dots',   label: 'Dots only' },
            { controls: 'none',   label: 'None — rely on swipe or autoplay' },
          ] as const).map(({ controls, label }) => (
            <div key={controls} className="space-y-md">
              <p className="text-label tracking-label uppercase text-fg-muted font-semibold">{label}</p>
              <SliderRow
                transition="slide"
                controls={controls}
                autoplay="off"
                loop="loop"
                peek="none"
                verticalPadding=""
                bgColorClass=""
              >
                {SLIDE_CONTENT.map((s, i) => (
                  <Slide key={i} n={i + 1} {...s} />
                ))}
              </SliderRow>
            </div>
          ))}
        </div>
      </div>

      {/* Settings reference */}
      <div>
        <SectionLabel index="04" title="Settings reference" />
        <div className="bg-surface p-lg font-mono text-label text-fg-muted space-y-md">
          {[
            { setting: 'transition', values: 'slide · fade · cover · morph',       note: 'How slides hand off to each other' },
            { setting: 'controls',   values: 'both · arrows · dots · none',        note: 'Which navigation controls render' },
            { setting: 'autoplay',   values: 'off · slow (8s) · medium (5s) · fast (3s)', note: 'Interval; resets on manual nav' },
            { setting: 'loop',       values: 'loop · bounce · stop',               note: 'Behavior at end of slide list' },
            { setting: 'peek',       values: 'none · sm (4%) · md (8%) · lg (14%)', note: 'Inset that bleeds adjacent slides' },
          ].map(r => (
            <div key={r.setting} className="flex flex-col md:flex-row md:gap-xl">
              <span className="text-fg w-[120px] flex-none">{r.setting}</span>
              <span className="w-[300px] flex-none">{r.values}</span>
              <span className="text-fg-muted">{r.note}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

// ─── Row Settings showcase ────────────────────────────────────────────────────

const GAP_SIZES = [
  { key: 'none',   cls: 'gap-0',   label: 'None',   val: '0' },
  { key: 'small',  cls: 'gap-sm',  label: 'Small',  val: '8px' },
  { key: 'medium', cls: 'gap-md',  label: 'Medium', val: '16px' },
  { key: 'large',  cls: 'gap-lg',  label: 'Large',  val: '32px' },
  { key: 'xl',     cls: 'gap-xl',  label: 'XL',     val: '64px' },
]

const ALIGN_DEMOS = [
  { key: 'start',   cls: 'items-start',   label: 'Start',   desc: 'Default. Short columns sit at the top of the row.' },
  { key: 'center',  cls: 'items-center',  label: 'Center',  desc: 'All columns center vertically. Useful for text-beside-image pairs.' },
  { key: 'end',     cls: 'items-end',     label: 'End',     desc: 'Columns anchor to the bottom — rare but useful for baseline grids.' },
  { key: 'stretch', cls: '',              label: 'Stretch', desc: 'Columns fill to the tallest sibling — natural flex default.' },
]

function MiniCol({ bg, height, label }: { bg: string; height: string; label: string }) {
  return (
    <div className={`flex-1 min-w-0 flex items-end p-sm ${bg}`} style={{ height }}>
      <span className="text-label font-semibold opacity-60 text-fg-on-brand">{label}</span>
    </div>
  )
}

function RowSettingsShowcase() {
  return (
    <div className="space-y-2xl">

      <div className="max-w-[640px]">
        <p className="text-body leading-body text-fg-muted">
          Display settings on <code className="font-mono text-fg">OT_LandingRow</code> control
          spacing, alignment, background, column ordering, and entrance animation. Most settings
          correspond directly to flex CSS properties on the row container.
        </p>
      </div>

      {/* Column gap */}
      <div>
        <SectionLabel index="01" title="Column gap" />
        <div className="max-w-[640px] mb-lg">
          <p className="text-body text-fg-muted">
            The <code className="font-mono text-fg">columnGap</code> setting maps directly to the flex
            gap between columns. Applies at every breakpoint.
          </p>
        </div>
        <div className="space-y-md">
          {GAP_SIZES.map(g => (
            <div key={g.key}>
              <p className="text-label tracking-label uppercase text-fg-muted font-semibold mb-xs">
                {g.label} — {g.val}
              </p>
              <div className={`flex flex-row ${g.cls}`} style={{ minHeight: '4rem' }}>
                <div className="flex-1 bg-brand opacity-80" />
                <div className="flex-1 bg-surface border border-fg/10" />
                <div className="flex-1 bg-accent opacity-80" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Align items */}
      <div>
        <SectionLabel index="02" title="Align items" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-xl">
          {ALIGN_DEMOS.map(a => (
            <div key={a.key} className="space-y-sm">
              <div>
                <p className="text-title font-semibold text-fg">{a.label}</p>
                <p className="text-label text-fg-muted">{a.desc}</p>
              </div>
              <div className={`flex flex-row gap-md ${a.cls}`} style={{ minHeight: '8rem' }}>
                <MiniCol bg="bg-brand" height="7rem" label="Tall" />
                <MiniCol bg="bg-surface border border-fg/10" height="3rem" label="Short" />
                <MiniCol bg="bg-accent" height="5rem" label="Mid" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Background colors */}
      <div>
        <SectionLabel index="03" title="Row background" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
          {[
            { key: 'none',      bg: '',                  label: 'None',       note: 'Transparent — inherits section background' },
            { key: 'canvas',    bg: 'bg-canvas',         label: 'Canvas',     note: 'Base page background' },
            { key: 'surface',   bg: 'bg-surface',        label: 'Surface',    note: 'Slightly raised from canvas' },
            { key: 'brand',     bg: 'bg-brand',          label: 'Brand',      note: 'Full brand color fill', dark: true },
            { key: 'brandDeep', bg: 'bg-brand-hover',   label: 'Brand deep', note: 'Deeper brand shade', dark: true },
            { key: 'glass',     bg: 'bg-glass',          label: 'Glass',      note: 'Translucent dark overlay', dark: true },
          ].map(b => (
            <div key={b.key} className={`p-md ${b.bg} border border-fg/10`} data-theme={b.dark ? 'dark' : undefined} style={{ minHeight: '5rem' }}>
              <p className="text-label tracking-label uppercase font-semibold text-fg opacity-60">{b.key === 'none' ? 'No bg' : b.key}</p>
              <p className="text-body text-fg font-medium mt-xs">{b.label}</p>
              <p className="text-label text-fg-muted mt-xs">{b.note}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Reverse */}
      <div>
        <SectionLabel index="04" title="Reverse column order" />
        <div className="max-w-[640px] mb-lg">
          <p className="text-body text-fg-muted">
            <code className="font-mono text-fg">reverseColumns</code> applies <code className="font-mono text-fg">flex-row-reverse</code>
            at the row's breakpoint — DOM order stays the same (accessible), only visual
            presentation flips. Use for alternating text/image pairs across sections.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-xl">
          <div className="space-y-sm">
            <p className="text-label tracking-label uppercase text-fg-muted font-semibold">Normal</p>
            <div className="flex flex-row gap-md" style={{ minHeight: '6rem' }}>
              <div className="flex-[2] bg-brand flex items-center justify-center">
                <span className="text-label font-semibold text-fg-on-brand">Image</span>
              </div>
              <div className="flex-1 bg-surface border border-fg/10 flex items-center justify-center">
                <span className="text-label font-semibold text-fg-muted">Text</span>
              </div>
            </div>
          </div>
          <div className="space-y-sm">
            <p className="text-label tracking-label uppercase text-fg-muted font-semibold">Reversed</p>
            <div className="flex flex-row-reverse gap-md" style={{ minHeight: '6rem' }}>
              <div className="flex-[2] bg-brand flex items-center justify-center">
                <span className="text-label font-semibold text-fg-on-brand">Image</span>
              </div>
              <div className="flex-1 bg-surface border border-fg/10 flex items-center justify-center">
                <span className="text-label font-semibold text-fg-muted">Text</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Settings reference */}
      <div>
        <SectionLabel index="05" title="Settings reference" />
        <div className="bg-surface p-lg font-mono text-label text-fg-muted space-y-sm">
          {[
            { setting: 'columnGap',         values: 'none · small · medium · large · xl' },
            { setting: 'alignItems',        values: 'start · center · end · stretch' },
            { setting: 'justifyContent',    values: 'start · center · end · between' },
            { setting: 'backgroundColor',   values: 'none · canvas · surface · brand · brandDeep · glass' },
            { setting: 'reverseColumns',    values: 'false · true' },
            { setting: 'verticalPadding',   values: 'none · small · medium · large · xl' },
            { setting: 'columnRhythm',      values: 'none · gentle · moderate · bold' },
            { setting: 'breakpoint',        values: 'sm · md · lg · xl (when columns go side-by-side)' },
            { setting: 'entranceAnimation', values: 'none · fade · slide · parallax' },
          ].map(r => (
            <div key={r.setting} className="flex flex-col md:flex-row md:gap-xl">
              <span className="text-fg w-[200px] flex-none">{r.setting}</span>
              <span>{r.values}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

// ─── Section Settings showcase ────────────────────────────────────────────────

const SECTION_WIDTHS = [
  { key: 'full',    cls: 'w-full',                            label: 'Full',    desc: 'Edge-to-edge — no container, no padding. Use for full-bleed images, sliders, and banner backgrounds.' },
  { key: 'default', cls: 'container mx-auto px-lg w-full',   label: 'Default', desc: 'Standard container with responsive max-width and horizontal padding. The correct choice for most content sections.' },
  { key: 'wide',    cls: 'max-w-7xl w-full mx-auto px-lg',   label: 'Wide',    desc: 'Slightly wider than default. Useful for data-dense grids or feature-rich layout areas.' },
  { key: 'narrow',  cls: 'max-w-4xl w-full mx-auto px-lg',   label: 'Narrow',  desc: 'Constrained to 56rem — forces reading focus for text-primary sections like long-form copy or single CTAs.' },
]

const SECTION_VSPACING = [
  { key: 'none',   cls: 'py-0',   label: 'None',   val: '0' },
  { key: 'small',  cls: 'py-md',  label: 'Small',  val: '16px' },
  { key: 'medium', cls: 'py-lg',  label: 'Medium', val: '32px' },
  { key: 'large',  cls: 'py-xl',  label: 'Large',  val: '64px' },
  { key: 'xl',     cls: 'py-2xl', label: 'XL',     val: '128px' },
]

function SectionSettingsShowcase() {
  return (
    <div className="space-y-2xl">

      <div className="max-w-[640px]">
        <p className="text-body leading-body text-fg-muted">
          Display settings on <code className="font-mono text-fg">OT_LandingSection</code> control
          content width, vertical padding, background color, section overlap, and entrance animation.
          Width and spacing together define the breathing room of every page region.
        </p>
      </div>

      {/* Width variants */}
      <div>
        <SectionLabel index="01" title="Content width" />
        <div className="space-y-md">
          {SECTION_WIDTHS.map(w => (
            <div key={w.key} className="border border-fg/10 overflow-hidden">
              <div className="bg-surface/50 px-md py-sm border-b border-fg/10">
                <p className="text-label tracking-label uppercase text-fg-muted font-semibold">
                  {w.key} — {w.label}
                </p>
                <p className="text-label text-fg-muted">{w.desc}</p>
              </div>
              <div className="relative bg-canvas/50 overflow-hidden" style={{ height: '3rem' }}>
                <div
                  className="absolute inset-y-0 bg-brand/30 border-x border-brand/50"
                  style={{
                    width: { full: '100%', wide: '88%', default: '76%', narrow: '58%' }[w.key],
                    left: '50%',
                    transform: 'translateX(-50%)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Vertical spacing */}
      <div>
        <SectionLabel index="02" title="Vertical spacing" />
        <div className="max-w-[640px] mb-lg">
          <p className="text-body text-fg-muted">
            <code className="font-mono text-fg">verticalSpacing</code> adds padding top and bottom
            to the section content area. Use Large (64px) as the default; step up to XL for hero
            moments, down to Small for tight utility rows like nav or banners.
          </p>
        </div>
        <div className="space-y-sm">
          {SECTION_VSPACING.map(s => (
            <div key={s.key} className="flex items-center gap-xl">
              <span className="text-label tracking-label uppercase text-fg-muted font-semibold w-[80px] flex-none">{s.label}</span>
              <span className="text-label font-mono text-fg w-[40px] flex-none">{s.val}</span>
              <div className="flex-1 relative bg-surface border border-fg/10 overflow-hidden" style={{ minHeight: '2rem' }}>
                <div className={`w-full ${s.cls} bg-brand/20`} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Background colors */}
      <div>
        <SectionLabel index="03" title="Section background" />
        <div className="space-y-md">
          {[
            { key: 'none',      cls: '',                label: 'None (transparent)',  dark: false, note: 'Inherits the page or outer background. Default.' },
            { key: 'canvas',    cls: 'bg-canvas',       label: 'Canvas',              dark: false, note: 'Explicit base page color — useful when surrounding context might override.' },
            { key: 'surface',   cls: 'bg-surface',      label: 'Surface',             dark: false, note: 'Slightly elevated from canvas — creates a visual break without strong contrast.' },
            { key: 'brand',     cls: 'bg-brand',        label: 'Brand',               dark: true,  note: 'Full brand-color fill. Forces dark theme on nested tokens.' },
            { key: 'brandDeep', cls: 'bg-brand-hover',  label: 'Brand deep',          dark: true,  note: 'Deeper shade for anchoring sections. Pairs well as a footer or closing section.' },
            { key: 'glass',     cls: 'bg-glass',        label: 'Glass',               dark: true,  note: 'Translucent dark overlay. Works over image or video backgrounds.' },
          ].map(b => (
            <div
              key={b.key}
              className={`flex items-center gap-md p-md ${b.cls} border border-fg/10`}
              data-theme={b.dark ? 'dark' : undefined}
            >
              <span className="text-label tracking-label uppercase font-semibold text-fg-muted w-[100px] flex-none">{b.key}</span>
              <span className="text-body font-medium text-fg w-[140px] flex-none">{b.label}</span>
              <span className="text-label text-fg-muted">{b.note}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Settings reference */}
      <div>
        <SectionLabel index="04" title="Settings reference" />
        <div className="bg-surface p-lg font-mono text-label text-fg-muted space-y-sm">
          {[
            { setting: 'gridWidth',         values: 'full · default · wide · narrow' },
            { setting: 'verticalSpacing',   values: 'none · small · medium · large · xl' },
            { setting: 'backgroundColor',   values: 'none · canvas · surface · brand · brandDeep · glass' },
            { setting: 'sectionOverlap',    values: 'none · shallow (16px) · mid (32px) · deep (64px) · full (128px)' },
            { setting: 'entranceAnimation', values: 'none · fade · slide · parallax' },
          ].map(r => (
            <div key={r.setting} className="flex flex-col md:flex-row md:gap-xl">
              <span className="text-fg w-[200px] flex-none">{r.setting}</span>
              <span>{r.values}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ShowcaseLayoutFeaturePage({
  params,
}: {
  params: Promise<{ feature: string }>
}) {
  const { feature } = await params
  if (!FEATURE_SLUGS.includes(feature as FeatureSlug)) notFound()

  return (
    <div className="py-xl px-lg space-y-2xl">
      <div>
        <p className="text-label tracking-label uppercase text-fg-muted font-semibold mb-sm">
          Layout
        </p>
        <h1 className="text-headline font-bold leading-headline tracking-headline text-fg">
          {LABELS[feature as FeatureSlug]}
        </h1>
      </div>

      {feature === 'row-rhythm'       && <RowRhythmShowcase />}
      {feature === 'section-overlap'  && <SectionOverlapShowcase />}
      {feature === 'carousel'         && <CarouselShowcase />}
      {feature === 'row-settings'     && <RowSettingsShowcase />}
      {feature === 'section-settings' && <SectionSettingsShowcase />}
    </div>
  )
}
