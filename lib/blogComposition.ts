import { sanitizeCmsHtml } from '@/lib/sanitizeHtml'
import { damContentReference } from '@/lib/damImages'

/**
 * Turns a simple article description into a CMS composition.
 *
 * This exists so that callers — Opal, a form, a script — describe an ARTICLE,
 * not a composition. Every trap we hit building the product pages by hand lives
 * here instead of in a caller's prompt:
 *
 *   - `layoutType: "outline"` on the experience, `"grid"` on sections
 *   - the nesting Visual Builder needs before it will select anything:
 *     experience > section > row > column > component
 *   - `displayName` on sections, or the Outline reads "Blank Section" throughout
 *   - array-of-component blocks are unplaceable, so the accordion is OT_FaqBlock
 *     with its rows in parallel string arrays
 *   - a `url` property silently discards "#", which renders CTAs disabled
 *
 * Callers get a flat list of section descriptions. Anything they send that is
 * not understood is skipped rather than throwing, so a slightly-wrong LLM
 * payload still produces a page.
 */

/**
 * Content-type maxLength limits, enforced here so a caller never has to know
 * them. A model writing an article will overrun these routinely, and the CMS
 * rejects the WHOLE page for one long field:
 *
 *   Property 'Body' must not be more than 200 characters.
 *   Property 'CTA Label' must not be more than 40 characters.
 *
 * Truncating at a word boundary loses a few words; failing loses the article.
 */
const LIMITS = {
  primaryHeadline: 120,
  faqHeadline:     160,
  quote:           500,
  quoteName:        80,
  quoteRole:       100,
  calloutHeading:  100,
  calloutBody:     200,
  cardHeading:     120,
  ctaLabel:         40,
  // Image / video / banner / divider / table, read off their content types.
  imageAlt:        200,
  imageCaption:    200,
  imageHeading:    120,
  videoTitle:      120,
  videoUrl:        300,
  bannerHeading:   120,
  dividerLabel:     40,
  tableHeadline:   160,
  tableIntro:      400,
} as const

function cap(text: string, max: number): string {
  const t = text.trim()
  if (t.length <= max) return t
  const cut = t.slice(0, max - 1)
  const space = cut.lastIndexOf(' ')
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`
}

// A `url` property will not store "#": the CMS discards it as invalid and Graph
// returns an empty string, which makes ButtonBlock render itself disabled.
const FALLBACK_URL = '/'

export type BlogSection =
  | { type: 'text';      heading?: string; body: string }
  | { type: 'accordion'; heading?: string; items: { question: string; answer: string }[] }
  | { type: 'quote';     text: string; author?: string; role?: string }
  | { type: 'callout';   heading: string; body?: string; ctaLabel?: string; ctaUrl?: string
                         intent?: 'info' | 'success' | 'warning' | 'danger' | 'neutral' | 'brand' }
  | { type: 'cards';     heading?: string; cards: { title: string; body?: string; ctaLabel?: string; ctaUrl?: string }[] }
  | { type: 'links';     heading: string; links: { label: string; url?: string }[] }
  // ── Images ────────────────────────────────────────────────────────────────
  | { type: 'image';     imageKey: string; alt?: string; caption?: string }
  | { type: 'imageText'; imageKey: string; alt?: string; heading?: string; body?: string
                         imageSide?: 'left' | 'right'; ctaLabel?: string; ctaUrl?: string }
  | { type: 'gallery';   heading?: string; images: { imageKey: string; alt?: string; caption?: string }[] }
  // ── Structure ─────────────────────────────────────────────────────────────
  | { type: 'steps';     heading?: string; intro?: string; steps: string[] }
  | { type: 'table';     heading?: string; intro?: string; columnLabels: string[]
                         rows: { label: string; cells: string[] }[] }
  | { type: 'divider';   label?: string }
  // ── Emphasis ──────────────────────────────────────────────────────────────
  | { type: 'stats';     heading?: string; stats: { value: string; label: string }[] }
  | { type: 'banner';    heading: string; body?: string; imageKey?: string
                         ctaLabel?: string; ctaUrl?: string }
  | { type: 'video';     videoUrl: string; title?: string; caption?: string
                         heading?: string; body?: string }

export type BlogInput = {
  title: string
  intro?: string
  /** DAM asset key for the lead image, already resolved by the caller. */
  heroImageKey?: string
  heroImageAlt?: string
  sections: BlogSection[]
  /** Breadcrumb trail above the title, e.g. ["Private", "Tips & guides"]. */
  breadcrumb?: string[]
}

// ── Node builders ───────────────────────────────────────────────────────────

type Node = Record<string, unknown>

const component = (
  contentType: string,
  template: string,
  settings: Record<string, string>,
  properties: Record<string, unknown>,
): Node => ({
  nodeType: 'component',
  displaySettings: { displayTemplate: template, settings },
  component: { contentType, properties },
})

const column = (nodes: Node[], span = 'col12'): Node => ({
  nodeType: 'column',
  displaySettings: {
    displayTemplate: 'OT_LandingColumn',
    settings: { gridSpan: span, contentSpacing: 'small', verticalPadding: 'none' },
  },
  nodes,
})

const row = (columns: Node[], anim = 'fade'): Node => ({
  nodeType: 'row',
  displaySettings: {
    displayTemplate: 'OT_LandingRow',
    // The stagger belongs on the row: [data-stagger] animates a node's children,
    // and a row's children are its columns.
    settings: {
      showAsRowFrom: 'lg', contentSpacing: 'medium',
      verticalPadding: 'small', entranceAnimation: anim,
    },
  },
  nodes: columns,
})

const section = (
  rows: Node[],
  name: string,
  bg = 'canvas',
  spacing = 'medium',
  width = 'narrow',
): Node => ({
  nodeType: 'section',
  layoutType: 'grid',
  // Without displayName every row of the Visual Builder Outline reads
  // "Blank Section", which is useless past the first one.
  displayName: name,
  displaySettings: {
    displayTemplate: 'OT_LandingSection',
    settings: {
      gridWidth: width, verticalSpacing: spacing,
      backgroundColor: bg, sectionOverlap: 'none', entranceAnimation: 'none',
    },
  },
  component: { contentType: 'BlankSection', properties: {} },
  nodes: rows,
})

/** One block, alone in its own section — the shape most article sections take. */
const single = (block: Node, name: string, bg = 'canvas', width = 'narrow'): Node =>
  section([row([column([block])])], name, bg, 'medium', width)

// ── Section mappers ─────────────────────────────────────────────────────────

const richText = (html: string, size = 'editorial') =>
  component('OT_RichTextBlock', 'OT_RichTextDefault',
    { color: 'none', alignment: 'left', size, treatment: 'standard' },
    { content: { value: { html: sanitizeCmsHtml(html) } } })

/**
 * A DAM image.
 *
 * The reference MUST carry the DamImageSource segment — see lib/damImages.ts.
 * `cms://content/<key>` is the format for ordinary CMS media and produces an
 * image block with no image when handed a DAM asset key.
 *
 * Populating `heading`/`body` makes OT_ImageBlock lay itself out in two
 * columns, which is what the `imageText` section relies on; leaving them empty
 * gives a plain full-width image.
 */
const imageBlock = (
  imageKey: string,
  opts: {
    alt?: string; caption?: string; heading?: string; bodyHtml?: string
    imageSide?: 'left' | 'right'; ctaLabel?: string; ctaUrl?: string
    ratio?: string; bg?: string
  } = {},
) =>
  component('OT_ImageBlock', 'OT_ImageDefault',
    {
      bgColor: opts.bg ?? 'canvas', ratio: opts.ratio ?? 'r16_9', spacing: 'small',
      overlay: 'false', frame: 'none', animate: 'false', captionPosition: 'below',
      shadow: 'false', lightbox: 'false', entranceAnimation: 'none',
    },
    {
      image: { value: damContentReference(imageKey) },
      // Alt text is not decoration. Falling back to the caption, then the
      // heading, beats shipping an empty alt on a content image.
      alt: { value: cap(opts.alt || opts.caption || opts.heading || 'Image', LIMITS.imageAlt) },
      ...(opts.caption   ? { caption:  { value: cap(opts.caption, LIMITS.imageCaption) } }  : {}),
      ...(opts.heading   ? { heading:  { value: cap(opts.heading, LIMITS.imageHeading) } }  : {}),
      ...(opts.bodyHtml  ? { body:     { value: { html: sanitizeCmsHtml(opts.bodyHtml) } } } : {}),
      ...(opts.imageSide ? { mediaSide: { value: opts.imageSide } }                          : {}),
      ...(opts.ctaLabel
        ? {
            ctaLabel: { value: cap(opts.ctaLabel, LIMITS.ctaLabel) },
            ctaUrl:   { value: opts.ctaUrl || FALLBACK_URL },
          }
        : {}),
    })

const primaryText = (headline: string, bodyHtml?: string, size = 'headline') =>
  component('OT_PrimaryTextBlock', 'OT_PrimaryTextDefault',
    { alignment: 'left', color: 'none', size, spacing: 'small', entranceAnimation: 'none' },
    {
      headline: { value: cap(headline, LIMITS.primaryHeadline) },
      headingLevel: { value: 'h2' },
      headerEffect: { value: 'none' },
      ...(bodyHtml ? { body: { value: { html: sanitizeCmsHtml(bodyHtml) } } } : {}),
    })

function mapSection(s: BlogSection, i: number): Node | null {
  switch (s.type) {
    case 'text':
      return single(
        s.heading ? primaryText(s.heading, s.body) : richText(s.body),
        s.heading || `Text ${i + 1}`)

    case 'accordion': {
      const items = (s.items || []).filter(x => x?.question && x?.answer)
      if (!items.length) return null
      // OT_FaqBlock, not OT_AccordionBlock: an elementEnabled type may not hold
      // an array of components, so the rows travel as parallel string arrays.
      return single(
        component('OT_FaqBlock', 'OT_FaqBlockDefault',
          { color: 'surface', openMode: 'single', defaultOpen: 'false' },
          {
            headline: { value: cap(s.heading || 'Questions', LIMITS.faqHeadline) },
            questions: { value: items.map(x => x.question) },
            answers:   { value: items.map(x => x.answer) },
          }),
        s.heading || `Accordion ${i + 1}`, 'surface')
    }

    case 'quote':
      return single(
        component('OT_QuoteBlock', 'OT_QuoteDefault',
          { color: 'none', alignment: 'left', size: 'small' },
          {
            treatment: { value: 'default' },
            quote: { value: cap(s.text, LIMITS.quote) },
            ...(s.author ? { attributionName:  { value: cap(s.author, LIMITS.quoteName) } } : {}),
            ...(s.role   ? { attributionTitle: { value: cap(s.role,   LIMITS.quoteRole) } }   : {}),
          }),
        'Quote')

    case 'callout':
      return single(
        component('OT_CalloutBlock', 'OT_CalloutDefault',
          {
            variant: 'filled', size: 'default', alignment: 'left',
            dismissible: 'off', sticky: 'off', icon: 'none',
            entranceAnimation: 'none', maxWidth: 'full',
          },
          {
            intent: { value: s.intent || 'info' },
            heading: { value: cap(s.heading, LIMITS.calloutHeading) },
            ...(s.body ? { body: { value: cap(s.body, LIMITS.calloutBody) } } : {}),
            ...(s.ctaLabel
              ? {
                  ctaLabel: { value: cap(s.ctaLabel, LIMITS.ctaLabel) },
                  ctaUrl:   { value: s.ctaUrl || FALLBACK_URL },
                }
              : {}),
          }),
        s.heading)

    case 'cards': {
      const cards = (s.cards || []).filter(c => c?.title).slice(0, 3)
      if (!cards.length) return null
      const rows: Node[] = []
      if (s.heading) rows.push(row([column([primaryText(s.heading)])]))
      rows.push(row(cards.map(c =>
        column([
          component('OT_CardBlock', 'OT_CardDefault',
            {
              tile: 'none', icon: 'none', fill: 'light', border: 'subtle',
              imageSide: 'left', hover: 'border', density: 'default',
              noise: 'false', accentLine: 'none', imageAspectRatio: 'landscape',
            },
            {
              Heading: { value: cap(c.title, LIMITS.cardHeading) },
              ...(c.body ? { Description: { value: { html: `<p>${escapeHtml(c.body)}</p>` } } } : {}),
              ...(c.ctaLabel
                ? {
                    ctaLabel: { value: cap(c.ctaLabel, LIMITS.ctaLabel) },
                    ctaUrl:   { value: c.ctaUrl || FALLBACK_URL },
                  }
                : {}),
            }),
        ], cards.length === 3 ? 'col4' : cards.length === 2 ? 'col6' : 'col12'))))
      return section(rows, s.heading || `Cards ${i + 1}`, 'canvas', 'medium', 'default')
    }

    case 'links': {
      const links = (s.links || []).filter(l => l?.label)
      if (!links.length) return null
      const list = links
        .map(l => `<li><a href="${escapeAttr(l.url || FALLBACK_URL)}">${escapeHtml(l.label)}</a></li>`)
        .join('')
      return single(richText(`<h2>${escapeHtml(s.heading)}</h2><ul>${list}</ul>`), s.heading)
    }

    // ── Images ──────────────────────────────────────────────────────────────

    case 'image':
      if (!s.imageKey) return null
      return single(
        imageBlock(s.imageKey, { alt: s.alt, caption: s.caption }),
        s.caption || `Image ${i + 1}`)

    case 'imageText': {
      if (!s.imageKey) return null
      // One block, not two columns of our own: OT_ImageBlock switches itself to
      // a two-column editorial layout as soon as heading or body is populated,
      // and its own layout survives an editor resizing the column afterwards.
      return single(
        imageBlock(s.imageKey, {
          alt: s.alt,
          heading: s.heading,
          bodyHtml: s.body,
          imageSide: s.imageSide === 'left' ? 'left' : 'right',
          ctaLabel: s.ctaLabel,
          ctaUrl: s.ctaUrl,
          ratio: 'r4_3',
        }),
        s.heading || `Image and text ${i + 1}`,
        'canvas', 'default')
    }

    case 'gallery': {
      const images = (s.images || []).filter(x => x?.imageKey).slice(0, 3)
      if (!images.length) return null
      const rows: Node[] = []
      if (s.heading) rows.push(row([column([primaryText(s.heading)])]))
      const span = images.length === 3 ? 'col4' : images.length === 2 ? 'col6' : 'col12'
      rows.push(row(images.map(img =>
        column([imageBlock(img.imageKey, { alt: img.alt, caption: img.caption, ratio: 'r1_1' })], span))))
      return section(rows, s.heading || `Gallery ${i + 1}`, 'canvas', 'medium', 'default')
    }

    // ── Structure ───────────────────────────────────────────────────────────

    case 'steps': {
      const steps = (s.steps || []).filter(x => typeof x === 'string' && x.trim())
      if (!steps.length) return null
      // An ordered list in rich text, not a stack of cards: numbered steps are
      // a list, and <ol> keeps the numbering correct for screen readers and
      // when an editor reorders them.
      const html =
        (s.intro ? `<p>${escapeHtml(s.intro)}</p>` : '')
        + `<ol>${steps.map(x => `<li>${escapeHtml(x)}</li>`).join('')}</ol>`
      return single(
        s.heading ? primaryText(s.heading, html) : richText(html),
        s.heading || `Steps ${i + 1}`)
    }

    case 'table': {
      const cols = (s.columnLabels || []).filter(x => typeof x === 'string')
      const rowsIn = (s.rows || []).filter(r => r?.label && Array.isArray(r.cells))
      if (cols.length < 1 || rowsIn.length < 1) return null
      // OT_CompareTable stores a FLAT, row-major cell array and rebuilds the
      // grid from columnLabels.length. A row that is short or long makes the
      // whole grid slip, so every row is padded/trimmed to the column count.
      //
      // Padded with an em dash, not "". The CMS DROPS empty strings from a
      // string array — a probe row of ["No"] against two columns came back
      // with five cells instead of six, which silently shifts every value
      // after it into the wrong column. A dash also reads correctly: it says
      // "not stated", where "no" would assert the feature is absent.
      const MISSING = '—'
      const cells: string[] = []
      for (const r of rowsIn) {
        for (let c = 0; c < cols.length; c++) {
          const raw = r.cells[c]
          const text = typeof raw === 'string' ? raw.trim() : ''
          cells.push(text || MISSING)
        }
      }
      return single(
        component('OT_CompareTable', 'OT_CompareTableDefault',
          { color: 'surface' },
          {
            ...(s.heading ? { headline: { value: cap(s.heading, LIMITS.tableHeadline) } } : {}),
            // `intro` is a plain string on this type, not richText. Posting
            // { html: … } is rejected: "requires an element of type 'String',
            // but the target element has type 'Object'".
            ...(s.intro   ? { intro:    { value: cap(s.intro, LIMITS.tableIntro) } } : {}),
            columnLabels: { value: cols },
            rowLabels:    { value: rowsIn.map(r => r.label) },
            cells:        { value: cells },
          }),
        s.heading || `Table ${i + 1}`, 'canvas', 'default')
    }

    case 'divider':
      return single(
        component('OT_DividerBlock', 'OT_DividerBlockDefault',
          {
            space: 'md', tone: 'neutral', weight: 'slim', reveal: 'static',
            ornament: s.label ? 'none' : 'dot',
          },
          {
            style: { value: 'mark' },
            ...(s.label ? { label: { value: cap(s.label, LIMITS.dividerLabel) } } : {}),
          }),
        s.label || 'Divider', 'canvas')

    // ── Emphasis ────────────────────────────────────────────────────────────

    case 'stats': {
      const stats = (s.stats || []).filter(x => x?.value && x?.label).slice(0, 4)
      if (!stats.length) return null
      // Rendered as cards, NOT OT_StatBlock. That type declares only
      // `sectionEnabled` and holds an array of OT_StatItem components, which
      // makes it unplaceable inside a column — it would be accepted by the CMS
      // and then render nothing. A card with the figure as its heading is the
      // honest approximation available here.
      const span = stats.length >= 4 ? 'col3' : stats.length === 3 ? 'col4' : stats.length === 2 ? 'col6' : 'col12'
      const rows: Node[] = []
      if (s.heading) rows.push(row([column([primaryText(s.heading)])]))
      rows.push(row(stats.map(st =>
        column([
          component('OT_CardBlock', 'OT_CardDefault',
            {
              tile: 'none', icon: 'none', fill: 'light', border: 'subtle',
              imageSide: 'left', hover: 'none', density: 'default',
              noise: 'false', accentLine: 'none', imageAspectRatio: 'landscape',
            },
            {
              Heading: { value: cap(st.value, LIMITS.cardHeading) },
              Description: { value: { html: `<p>${escapeHtml(st.label)}</p>` } },
            }),
        ], span))))
      return section(rows, s.heading || `Stats ${i + 1}`, 'surface', 'medium', 'default')
    }

    case 'banner':
      if (!s.heading) return null
      return single(
        component('OT_BannerBlock', 'OT_BannerBlockDefault',
          { color: 'brand', alignment: 'center', size: 'compact', imageBlend: 'overlay' },
          {
            treatment: { value: 'scrim' },
            heading: { value: cap(s.heading, LIMITS.bannerHeading) },
            headingLevel: { value: 'h2' },
            ...(s.body ? { body: { value: { html: `<p>${escapeHtml(s.body)}</p>` } } } : {}),
            ...(s.imageKey ? { backgroundImage: { value: damContentReference(s.imageKey) } } : {}),
            ...(s.ctaLabel
              ? {
                  primaryCtaLabel: { value: cap(s.ctaLabel, LIMITS.ctaLabel) },
                  primaryCtaUrl:   { value: s.ctaUrl || FALLBACK_URL },
                }
              : {}),
          }),
        s.heading, 'canvas', 'default')

    case 'video': {
      // The content type enforces a YouTube/Vimeo pattern. Anything else is
      // rejected by the CMS and takes the whole article with it, so drop the
      // section instead of losing the page.
      const ok = /^https?:\/\/(www\.)?(youtube\.com\/(watch|shorts|embed)|youtu\.be\/|vimeo\.com\/)\S+$/
        .test(s.videoUrl || '')
      if (!ok) return null
      return single(
        component('OT_VideoBlock', 'OT_VideoDefault',
          {
            bgColor: 'canvas', ratio: 'r16_9', overlay: 'false', frame: 'none',
            captionPosition: 'below', shadow: 'false', entranceAnimation: 'none',
          },
          {
            videoUrl: { value: s.videoUrl.slice(0, LIMITS.videoUrl) },
            ...(s.title   ? { title:   { value: cap(s.title, LIMITS.videoTitle) } }     : {}),
            ...(s.caption ? { caption: { value: cap(s.caption, LIMITS.imageCaption) } } : {}),
            ...(s.heading ? { heading: { value: cap(s.heading, LIMITS.imageHeading) } } : {}),
            ...(s.body    ? { body:    { value: { html: sanitizeCmsHtml(s.body) } } }   : {}),
          }),
        s.title || s.heading || `Video ${i + 1}`, 'canvas', 'default')
    }

    default:
      // Unknown section types are skipped rather than throwing: a payload from a
      // model is better rendered partially than rejected wholesale.
      return null
  }
}

function escapeHtml(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
function escapeAttr(s: string) {
  return escapeHtml(s).replace(/"/g, '&quot;')
}

// ── Entry point ─────────────────────────────────────────────────────────────

export function buildBlogComposition(input: BlogInput) {
  const nodes: Node[] = []

  if (input.breadcrumb?.length) {
    const trail = input.breadcrumb
      .map((c, i, a) =>
        i === a.length - 1
          ? `<span>${escapeHtml(c)}</span>`
          : `<a href="${FALLBACK_URL}">${escapeHtml(c)}</a>`)
      .join(' / ')
    nodes.push(section([row([column([richText(`<p>${trail}</p>`, 'compact')])])],
      'Breadcrumb', 'canvas', 'none'))
  }

  nodes.push(single(
    primaryText(input.title, input.intro ? `<p>${escapeHtml(input.intro)}</p>` : undefined, 'display'),
    'Title'))

  if (input.heroImageKey) {
    // This used to write `cms://content/<key>`, which is the format for
    // ordinary CMS media. A DAM asset needs the DamImageSource segment or the
    // block renders with no image at all — see lib/damImages.ts.
    nodes.push(single(
      imageBlock(input.heroImageKey, {
        alt: input.heroImageAlt || input.title,
        ratio: 'r16_9',
      }),
      'Lead image', 'canvas', 'default'))
  }

  for (const [i, s] of (input.sections || []).entries()) {
    const node = mapSection(s, i)
    if (node) nodes.push(node)
  }

  return { nodeType: 'experience', layoutType: 'outline', nodes }
}
