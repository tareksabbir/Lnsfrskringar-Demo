import { sanitizeCmsHtml } from '@/lib/sanitizeHtml'

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
    nodes.push(single(
      component('OT_ImageBlock', 'OT_ImageDefault',
        {
          bgColor: 'canvas', ratio: 'r16_9', spacing: 'small', overlay: 'false',
          frame: 'none', animate: 'false', captionPosition: 'below',
          shadow: 'false', lightbox: 'false', entranceAnimation: 'none',
        },
        {
          image: { value: `cms://content/${input.heroImageKey}` },
          alt:   { value: input.heroImageAlt || input.title },
        }),
      'Lead image'))
  }

  for (const [i, s] of (input.sections || []).entries()) {
    const node = mapSection(s, i)
    if (node) nodes.push(node)
  }

  return { nodeType: 'experience', layoutType: 'outline', nodes }
}
