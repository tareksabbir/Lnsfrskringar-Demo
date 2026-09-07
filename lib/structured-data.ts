/**
 * lib/structured-data.ts
 *
 * Builds JSON-LD structured data objects from page + site fields.
 *
 * No @optimizely/cms-sdk imports — this file is deliberately CMS-agnostic so
 * it can be called from any server component or route handler without pulling
 * in SDK internals.
 *
 * ── Two levels, one graph ────────────────────────────────────────────────────
 * PAGE level describes the document: Organization, WebSite, the page's own node
 * (WebPage / Article / Event / Product / Person) and its BreadcrumbList.
 *
 * BLOCK level describes what the page is built from. Most blocks are known
 * before render — they sit in the composition tree the route already fetched —
 * so `collectBlockSchema` walks that tree once and returns their nodes to be
 * merged into the same `@graph`. One graph per page, rather than a script tag
 * per block, keeps Organization from being repeated a dozen times and lets the
 * block nodes reference the page node by `@id`.
 *
 * Blocks that fetch their own data at render time (event and location listings)
 * cannot be seen from the tree — only their configuration is in the
 * composition. Those emit their own `<JsonLd>` from their server adapter, using
 * the builders at the bottom of this file.
 */
import type { PageSeoFields, SiteMetaSettings } from '@/lib/metadata'

// ── Node id anchors ───────────────────────────────────────────────────────────
// Nodes are given stable @ids so they can reference each other instead of
// repeating themselves, which is what turns a list of nodes into a graph.
const ORG_ID       = (origin: string) => `${origin}/#organization`
const SITE_ID      = (origin: string) => `${origin}/#website`
const PAGE_ID      = (pageUrl: string) => `${pageUrl}#webpage`
const CRUMBS_ID    = (pageUrl: string) => `${pageUrl}#breadcrumb`

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Builds a schema.org JSON-LD graph from page-level and site-level fields.
 *
 * Always includes Organization and WebSite nodes. The page's own node is
 * emitted from `page.schemaType`, defaulting to WebPage — `schemaType: 'none'`
 * is the way to opt out entirely.
 *
 * customSchemaJson is merged in as an additional node when valid JSON is
 * provided — parsing errors are swallowed with a console.warn; they never
 * crash the page.
 *
 * @param page    - SEO fields from the page content item
 * @param site    - Global settings from OT_ThemeManager
 * @param pageUrl - The full canonical URL of the page (e.g. "https://example.com/about")
 */
export function buildJsonLd(
  page: PageSeoFields,
  site: SiteMetaSettings,
  pageUrl: string,
): object {
  // Derive the site origin (protocol + host) from the full page URL.
  let origin = ''
  try {
    origin = new URL(pageUrl).origin
  } catch {
    // pageUrl may be relative or empty in edge cases — leave origin blank.
  }

  const logoUrl = site.logo?.url?.default ?? undefined

  // ── Organization node (always emitted) ─────────────────────────────────────
  const organizationNode: Record<string, unknown> = {
    '@type': 'Organization',
    ...(origin ? { '@id': ORG_ID(origin) } : {}),
    name:    site.siteName ?? undefined,
    url:     origin || undefined,
    description: site.organizationDescription ?? undefined,
    ...(logoUrl ? { logo: { '@type': 'ImageObject', url: logoUrl } } : {}),
  }

  // ── WebSite node (always emitted) ──────────────────────────────────────────
  const webSiteNode: Record<string, unknown> = {
    '@type': 'WebSite',
    ...(origin ? { '@id': SITE_ID(origin), publisher: { '@id': ORG_ID(origin) } } : {}),
    name:    site.siteName ?? undefined,
    url:     origin || undefined,
  }

  // ── Base graph (always emitted) ────────────────────────────────────────────
  const graph: unknown[] = [organizationNode, webSiteNode]

  // ── Breadcrumbs ────────────────────────────────────────────────────────────
  // Derived from the URL unless the caller supplied a trail. Emitted before the
  // page node so the page node can point at it.
  const crumbs = page.breadcrumbTrail?.length
    ? page.breadcrumbTrail
    : deriveBreadcrumbTrail(pageUrl, page.seoTitle ?? undefined)

  if (crumbs.length > 1) {
    graph.push({
      '@type': 'BreadcrumbList',
      '@id':   CRUMBS_ID(pageUrl),
      itemListElement: crumbs.map((crumb, i) => ({
        '@type':  'ListItem',
        position: i + 1,
        name:     crumb.name,
        // The last crumb is the current page: schema.org asks for no `item` on
        // it, because it would only point back at the page describing it.
        ...(i < crumbs.length - 1 && crumb.url ? { item: crumb.url } : {}),
      })),
    })
  }

  // ── Page-specific schema node ──────────────────────────────────────────────
  // schemaType selects the semantic type of the page itself (WebPage, Article,
  // Product, etc.). 'FAQPage' here means the *entire* page is a FAQ page — a
  // legitimate but uncommon choice. In most cases pages that happen to contain
  // an accordion should use their natural type (WebPage, Product, etc.) and
  // let the FAQ node be added automatically below.
  //
  // An unset schemaType means WebPage rather than nothing: every page is at
  // least a page, and the node is what carries the breadcrumb and site links.
  const schemaType = page.schemaType?.trim() || 'WebPage'
  if (schemaType !== 'none') {
    const description = page.pageAnswer ?? page.seoDescription ?? undefined
    const imageUrl    = page.ogImage?.url?.default ?? undefined

    // Properties every page-level node shares. They are what makes the node
    // part of the site rather than an island.
    const common: Record<string, unknown> = {
      '@id':  PAGE_ID(pageUrl),
      url:    pageUrl,
      ...(origin ? { isPartOf: { '@id': SITE_ID(origin) } } : {}),
      ...(crumbs.length > 1 ? { breadcrumb: { '@id': CRUMBS_ID(pageUrl) } } : {}),
      ...(imageUrl ? { image: imageUrl } : {}),
    }

    let pageNode: Record<string, unknown> | undefined

    switch (schemaType) {
      case 'WebPage':
        pageNode = {
          '@type': 'WebPage',
          ...common,
          name:    page.seoTitle ?? undefined,
          description,
        }
        break

      case 'Article':
      case 'BlogPosting':
        pageNode = {
          '@type': schemaType,
          ...common,
          headline: page.seoTitle ?? undefined,
          description,
          ...articleProperties(page.article, origin),
        }
        break

      case 'FAQPage':
        // Explicitly selected — skip the automatic FAQ node below (no duplicate).
        pageNode = {
          '@type': 'FAQPage',
          ...common,
          name: page.seoTitle ?? undefined,
          description,
          mainEntity: buildFaqMainEntity(page.faqItems),
        }
        break

      case 'Product':
        pageNode = {
          '@type': 'Product',
          ...common,
          name:    page.seoTitle ?? undefined,
          description,
        }
        break

      case 'Event':
        pageNode = {
          '@type': 'Event',
          ...common,
          name:    page.seoTitle ?? undefined,
          description,
          ...eventProperties(page.event, site, origin),
        }
        break

      case 'CollectionPage':
        pageNode = {
          '@type': 'CollectionPage',
          ...common,
          name:    page.seoTitle ?? undefined,
          description,
        }
        break

      case 'Person':
        pageNode = {
          '@type': 'Person',
          ...common,
          name:        page.person?.name ?? page.seoTitle ?? undefined,
          jobTitle:    page.person?.jobTitle ?? undefined,
          description: page.person?.description ?? description,
          ...(page.person?.worksFor
            ? { worksFor: { '@type': 'Organization', name: page.person.worksFor } }
            : {}),
        }
        break

      default:
        // An unrecognised schemaType is honoured as a bare typed node rather
        // than dropped: the CMS enum can gain a value before this file does.
        pageNode = {
          '@type': schemaType,
          ...common,
          name:    page.seoTitle ?? undefined,
          description,
        }
    }

    if (pageNode) graph.push(pageNode)
  }

  // ── Auto FAQ node ──────────────────────────────────────────────────────────
  // When accordion or FAQ blocks are present on the page AND the editor has not
  // explicitly selected 'FAQPage' as the schema type, add a FAQPage node
  // to the graph automatically. This means a product page, landing page, or
  // service page that happens to include an FAQ accordion gets both its
  // natural schema type AND the FAQPage rich-result eligibility — without
  // the editor needing to choose between them.
  if (schemaType !== 'FAQPage' && page.faqItems?.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id':   `${pageUrl}#faq`,
      url:  pageUrl,
      ...(schemaType !== 'none' ? { mainEntityOfPage: { '@id': PAGE_ID(pageUrl) } } : {}),
      mainEntity: buildFaqMainEntity(page.faqItems),
    })
  }

  // ── Block-level nodes ──────────────────────────────────────────────────────
  // Collected from the composition tree by collectBlockSchema() and passed in
  // by the route. They describe the page's content, so they hang off the page
  // node rather than standing alone.
  for (const node of page.blockSchema ?? []) {
    if (!node || typeof node !== 'object') continue
    graph.push(
      schemaType === 'none'
        ? node
        : { ...(node as Record<string, unknown>), mainEntityOfPage: { '@id': PAGE_ID(pageUrl) } },
    )
  }

  // ── Merge customSchemaJson ─────────────────────────────────────────────────
  if (page.customSchemaJson && page.customSchemaJson.trim()) {
    try {
      const parsed = JSON.parse(page.customSchemaJson)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        graph.push(parsed)
      }
    } catch {
      console.warn(
        '[structured-data] customSchemaJson contains invalid JSON and will be ignored.',
        page.customSchemaJson,
      )
    }
  }

  return { '@context': 'https://schema.org', '@graph': graph }
}

// ── Page-node enrichment ──────────────────────────────────────────────────────

/** Article/BlogPosting properties Google asks for beyond headline + description. */
function articleProperties(
  article: PageSeoFields['article'],
  origin: string,
): Record<string, unknown> {
  if (!article) return {}
  return {
    ...(article.datePublished ? { datePublished: article.datePublished } : {}),
    ...(article.dateModified  ? { dateModified:  article.dateModified }  : {}),
    ...(article.image         ? { image: article.image } : {}),
    ...(article.section       ? { articleSection: article.section } : {}),
    ...(article.authorName
      ? {
          author: {
            '@type': 'Person',
            name:    article.authorName,
            ...(article.authorTitle ? { jobTitle: article.authorTitle } : {}),
            ...(article.authorUrl   ? { url: article.authorUrl } : {}),
          },
        }
      : {}),
    ...(origin ? { publisher: { '@id': ORG_ID(origin) } } : {}),
  }
}

/**
 * Event properties. `location` is required by Google for an Event rich result,
 * and its shape depends on whether the event is online: a VirtualLocation with
 * a URL, or a Place with an address.
 */
function eventProperties(
  event: PageSeoFields['event'],
  site: SiteMetaSettings,
  origin: string,
): Record<string, unknown> {
  if (!event) return {}

  const isOnline = event.locationType?.toLowerCase().includes('online') ?? false
  const place    = event.venueName || event.city

  return {
    ...(event.startDate ? { startDate: event.startDate } : {}),
    ...(event.endDate   ? { endDate:   event.endDate }   : {}),
    ...(event.image     ? { image:     event.image }     : {}),
    ...(event.registrationUrl
      ? {
          offers: {
            '@type': 'Offer',
            url:     event.registrationUrl,
            availability: 'https://schema.org/InStock',
          },
        }
      : {}),
    ...(isOnline
      ? {
          eventAttendanceMode: 'https://schema.org/OnlineEventAttendanceMode',
          location: {
            '@type': 'VirtualLocation',
            url:     event.registrationUrl ?? (origin || undefined),
          },
        }
      : place
        ? {
            eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
            location: {
              '@type': 'Place',
              name:    event.venueName ?? event.city ?? undefined,
              ...(event.city
                ? { address: { '@type': 'PostalAddress', addressLocality: event.city } }
                : {}),
            },
          }
        : {}),
    ...(site.siteName
      ? { organizer: { '@type': 'Organization', name: site.siteName, ...(origin ? { url: origin } : {}) } }
      : {}),
  }
}

// ── Block-level collection ────────────────────────────────────────────────────

export type BlockSchemaResult = {
  /** Question/answer pairs, fed back through `page.faqItems`. */
  faqItems: Array<{ question: string; answer: string }>
  /** Ready-to-emit schema.org nodes for the blocks on the page. */
  nodes:    Array<Record<string, unknown>>
}

/**
 * Walks a Visual Builder composition tree once and returns the schema.org
 * nodes its blocks justify.
 *
 * Node shapes in the tree:
 *   CompositionComponentNode → { __typename: 'CompositionComponentNode', component: { __typename, … } }
 *   Structure nodes (section/row/column) → { nodes: [...children] }
 *
 * What is deliberately NOT emitted: a node per card, stat or table. Structured
 * data is a description of the page for a machine, not a mirror of its markup,
 * and every node that carries no distinct meaning is noise a validator will
 * eventually flag. Images without a caption are skipped for the same reason —
 * a decorative image says nothing worth indexing.
 */
export function collectBlockSchema(nodes: unknown[], pageUrl = ''): BlockSchemaResult {
  const faqItems: BlockSchemaResult['faqItems'] = []
  const schemaNodes: BlockSchemaResult['nodes'] = []
  const seen = new Set<string>()

  /** Blocks are reused across pages and can repeat on one; emit each once. */
  const push = (node: Record<string, unknown>) => {
    const fingerprint = JSON.stringify(node)
    if (seen.has(fingerprint)) return
    seen.add(fingerprint)
    schemaNodes.push(node)
  }

  function traverse(list: unknown[]) {
    for (const raw of list ?? []) {
      const node = raw as {
        __typename?: string
        component?: Record<string, unknown> & { __typename?: string }
        nodes?: unknown[]
      }

      if (node?.__typename === 'CompositionComponentNode' && node.component) {
        collectFromBlock(node.component, { faqItems, push, pageUrl })
      }
      if (node?.nodes?.length) traverse(node.nodes)
    }
  }

  traverse(nodes)
  return { faqItems, nodes: schemaNodes }
}

function collectFromBlock(
  block: Record<string, unknown> & { __typename?: string },
  ctx: {
    faqItems: BlockSchemaResult['faqItems']
    push: (node: Record<string, unknown>) => void
    pageUrl: string
  },
) {
  switch (block.__typename) {
    // ── FAQ ──────────────────────────────────────────────────────────────────
    // Two block types hold question/answer pairs in two different shapes:
    // OT_AccordionBlock nests OT_AccordionItem components, OT_FaqBlock keeps
    // two parallel string arrays. Both feed one FAQPage node.
    case 'OT_AccordionBlock': {
      const items = (block.items ?? []) as Array<{ question?: string; answer?: string }>
      for (const item of items) {
        if (item?.question && item?.answer) {
          ctx.faqItems.push({ question: item.question, answer: item.answer })
        }
      }
      break
    }

    case 'OT_FaqBlock': {
      const questions = (block.questions ?? []) as string[]
      const answers   = (block.answers   ?? []) as string[]
      questions.forEach((question, i) => {
        const answer = answers[i]
        if (question && answer) ctx.faqItems.push({ question, answer })
      })
      break
    }

    // ── Video ────────────────────────────────────────────────────────────────
    case 'OT_VideoBlock': {
      const embedUrl = asString(block.videoUrl)
      const name     = asString(block.title) ?? asString(block.heading)
      if (!embedUrl || !name) break
      const thumbnailUrl = videoThumbnail(embedUrl)
      ctx.push({
        '@type': 'VideoObject',
        name,
        description: asString(block.caption) ?? asString(block.body) ?? undefined,
        embedUrl,
        ...(thumbnailUrl ? { thumbnailUrl } : {}),
      })
      break
    }

    // ── Image ────────────────────────────────────────────────────────────────
    case 'OT_ImageBlock': {
      const contentUrl = urlOf(block.image)
      const caption    = asString(block.caption)
      if (!contentUrl || !caption) break
      ctx.push({
        '@type': 'ImageObject',
        contentUrl,
        caption,
        ...(asString(block.alt) ? { name: asString(block.alt) } : {}),
      })
      break
    }

    // ── Quote ────────────────────────────────────────────────────────────────
    // Quotation, not Review: the block carries no rating and no reviewed item,
    // and a Review node without either is the kind of claim that earns a
    // manual action rather than a rich result.
    case 'OT_QuoteBlock': {
      const text = asString(block.quote)
      if (!text) break
      const name = asString(block.attributionName)
      ctx.push({
        '@type': 'Quotation',
        text,
        ...(name
          ? {
              creator: {
                '@type': 'Person',
                name,
                ...(asString(block.attributionTitle) ? { jobTitle: asString(block.attributionTitle) } : {}),
              },
            }
          : {}),
      })
      break
    }
  }
}

// ── Listing-block builders (block level, data fetched at render time) ─────────

/**
 * ItemList of Events for OT_EventListingBlock.
 *
 * The listing's events are fetched inside the adapter, so the page-level tree
 * walk cannot see them — this is called from the adapter instead.
 */
export function buildEventListJsonLd(
  events: Array<{
    title?: string | null
    startDate?: string | null
    endDate?: string | null
    url?: string | null
    imageUrl?: string | null
    city?: string | null
    venueName?: string | null
  }>,
  opts: { name?: string; origin?: string } = {},
): object | null {
  const items = events.filter(event => event?.title)
  if (!items.length) return null

  return {
    '@context': 'https://schema.org',
    '@type':    'ItemList',
    ...(opts.name ? { name: opts.name } : {}),
    itemListElement: items.map((event, i) => ({
      '@type':  'ListItem',
      position: i + 1,
      item: {
        '@type': 'Event',
        name:    event.title,
        ...(event.startDate ? { startDate: event.startDate } : {}),
        ...(event.endDate   ? { endDate:   event.endDate }   : {}),
        ...(event.url       ? { url: absolute(event.url, opts.origin) } : {}),
        ...(event.imageUrl  ? { image: event.imageUrl } : {}),
        ...(event.venueName || event.city
          ? {
              location: {
                '@type': 'Place',
                name:    event.venueName ?? event.city,
                ...(event.city
                  ? { address: { '@type': 'PostalAddress', addressLocality: event.city } }
                  : {}),
              },
            }
          : {}),
      },
    })),
  }
}

/**
 * ItemList of LocalBusiness branches for OT_LocationListingBlock.
 *
 * `address` is one free-text field on OT_LocationProfile, so it goes into
 * `streetAddress` whole rather than being split into parts this side of the CMS
 * — a wrong `addressLocality` is worse than an absent one. Coordinates are
 * included when the adapter's geocoding step resolved them.
 */
export function buildLocationListJsonLd(
  locations: Array<{
    locationName?: string
    address?: string
    imageUrl?: string
    url?: string
    coordinates?: { lat: number; lon: number }
  }>,
  opts: { name?: string; origin?: string; parentOrganization?: string } = {},
): object | null {
  const items = locations.filter(location => location?.locationName)
  if (!items.length) return null

  return {
    '@context': 'https://schema.org',
    '@type':    'ItemList',
    ...(opts.name ? { name: opts.name } : {}),
    itemListElement: items.map((location, i) => ({
      '@type':  'ListItem',
      position: i + 1,
      item: {
        '@type': 'LocalBusiness',
        name:    location.locationName,
        ...(location.address
          ? { address: { '@type': 'PostalAddress', streetAddress: location.address } }
          : {}),
        ...(location.imageUrl ? { image: location.imageUrl } : {}),
        ...(location.url ? { url: absolute(location.url, opts.origin) } : {}),
        ...(location.coordinates
          ? {
              geo: {
                '@type':    'GeoCoordinates',
                latitude:   location.coordinates.lat,
                longitude:  location.coordinates.lon,
              },
            }
          : {}),
        ...(opts.parentOrganization
          ? { parentOrganization: { '@type': 'Organization', name: opts.parentOrganization } }
          : {}),
      },
    })),
  }
}

/**
 * Blog + ItemList for the /blog index.
 *
 * The index is a code route with no CMS content item behind it, so it has no
 * SEO fields to run through buildJsonLd — it gets its own builder.
 */
export function buildBlogIndexJsonLd(
  posts: Array<{
    title: string
    path: string
    description?: string | null
    published?: string | null
    imageUrl?: string | null
  }>,
  site: SiteMetaSettings,
  pageUrl: string,
): object {
  let origin = ''
  try {
    origin = new URL(pageUrl).origin
  } catch { /* leave blank */ }

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Blog',
        '@id':   `${pageUrl}#blog`,
        url:     pageUrl,
        name:    site.siteName ? `${site.siteName} — Blog` : 'Blog',
        ...(origin ? { publisher: { '@id': ORG_ID(origin) }, isPartOf: { '@id': SITE_ID(origin) } } : {}),
        blogPost: posts.map(post => ({
          '@type':   'BlogPosting',
          headline:  post.title,
          url:       absolute(post.path, origin),
          ...(post.description ? { description: post.description } : {}),
          ...(post.published   ? { datePublished: post.published } : {}),
          ...(post.imageUrl    ? { image: post.imageUrl } : {}),
          ...(origin ? { publisher: { '@id': ORG_ID(origin) } } : {}),
        })),
      },
      {
        '@type': 'BreadcrumbList',
        '@id':   CRUMBS_ID(pageUrl),
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: origin ? `${origin}/` : undefined },
          { '@type': 'ListItem', position: 2, name: 'Blog' },
        ],
      },
    ],
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildFaqMainEntity(
  items: PageSeoFields['faqItems'],
): unknown[] {
  return (items ?? []).map(item => ({
    '@type': 'Question',
    name: item.question,
    acceptedAnswer: { '@type': 'Answer', text: item.answer },
  }))
}

/**
 * Builds a breadcrumb trail from the page URL: `/product/car-insurance` becomes
 * Home → Product → Car insurance.
 *
 * A leading two-letter segment is treated as a locale prefix and kept in the
 * URLs without becoming a crumb of its own — "Sv" is not a step in the site's
 * hierarchy. The last crumb uses the page's SEO title when there is one,
 * because "Car insurance for young drivers" beats a de-slugified segment.
 */
function deriveBreadcrumbTrail(
  pageUrl: string,
  pageTitle?: string,
): Array<{ name: string; url?: string }> {
  let origin = ''
  let segments: string[] = []
  try {
    const url = new URL(pageUrl)
    origin    = url.origin
    segments  = url.pathname.split('/').filter(Boolean)
  } catch {
    return []
  }

  const localePrefix = segments[0]?.length === 2 ? segments.shift() : undefined
  if (!segments.length) return []

  const base  = localePrefix ? `${origin}/${localePrefix}` : origin
  const trail: Array<{ name: string; url?: string }> = [
    { name: 'Home', url: `${base}/` },
  ]

  segments.forEach((segment, i) => {
    const isLast = i === segments.length - 1
    trail.push({
      name: isLast && pageTitle ? pageTitle : deslugify(segment),
      url:  `${base}/${segments.slice(0, i + 1).join('/')}`,
    })
  })

  return trail
}

/** `car-insurance` → `Car insurance`. */
function deslugify(segment: string): string {
  const words = decodeURIComponent(segment).replace(/[-_]+/g, ' ').trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/**
 * A thumbnail is required for a VideoObject rich result and neither the block
 * nor Graph stores one. YouTube's is derivable from the id; Vimeo's needs an
 * API call, so those videos go out without one rather than with a guess.
 */
function videoThumbnail(url: string): string | undefined {
  const youTube = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([\w-]{11})/,
  )
  return youTube ? `https://i.ytimg.com/vi/${youTube[1]}/hqdefault.jpg` : undefined
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

/** Pulls the CDN URL out of a Graph image/link field. */
function urlOf(value: unknown): string | undefined {
  const url = (value as { url?: { default?: string | null } | null } | null)?.url?.default
  return asString(url)
}

function absolute(path: string, origin?: string): string {
  if (/^https?:\/\//i.test(path)) return path
  if (!origin) return path
  return `${origin.replace(/\/$/, '')}${path.startsWith('/') ? '' : '/'}${path}`
}
