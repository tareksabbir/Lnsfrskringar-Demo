# Structured data (schema.org JSON-LD)

Every public page emits one `<script type="application/ld+json">` containing one
`@graph`. That graph describes the page *and* the blocks it is built from.

- Builder: [`lib/structured-data.ts`](../lib/structured-data.ts)
- Script tag: [`components/seo/JsonLd.tsx`](../components/seo/JsonLd.tsx)
- Field shapes: `PageSeoFields` in [`lib/metadata.ts`](../lib/metadata.ts)

## One graph, not a tag per block

A single graph per page is deliberate. Emitting a script per block repeats the
Organization node a dozen times on a long page and leaves the nodes unrelated to
each other; inside one graph they carry `@id`s and reference the page, the site
and the organization by them.

```
Organization   @id  <origin>/#organization
WebSite        @id  <origin>/#website          publisher → Organization
BreadcrumbList @id  <pageUrl>#breadcrumb
WebPage|Article|Event|Product|Person|CollectionPage
               @id  <pageUrl>#webpage          isPartOf → WebSite, breadcrumb → BreadcrumbList
FAQPage        @id  <pageUrl>#faq              mainEntityOfPage → the page node
block nodes    (VideoObject, ImageObject, Quotation)  mainEntityOfPage → the page node
```

## Page level

`buildJsonLd(page, site, pageUrl)` takes the content item's SEO fields and the
ThemeManager, and is called from every route that renders a page:

| Route | Page node |
|---|---|
| `app/(site)/page.tsx` | `WebPage` (home) |
| `app/(site)/[...slug]/page.tsx` | from `schemaType`; `BlogPosting` for `/blog/<slug>`, `Event` for `OT_EventPage`, `Person` for `OT_PractitionerPage`, `CollectionPage` for `OT_TopicHubPage` |
| `app/(site)/blog/page.tsx` | `Blog` + `BreadcrumbList` via `buildBlogIndexJsonLd` — a code route with no content item behind it |

Things worth knowing before changing this:

- **`schemaType` unset means `WebPage`, not nothing.** Every page is at least a
  page, and that node is what carries the breadcrumb and the site link.
  `schemaType: 'none'` is the opt-out. An unrecognised value is passed through as
  a bare typed node, so the CMS enum can gain a value before this file does.
- **Articles are identified by path.** They are `BlankExperience` documents (see
  [blog-and-opal.md](blog-and-opal.md)), so nothing on the content item says
  "article" — `/blog/<slug>` does. An explicit `schemaType` still wins.
- **`article` and `event` on `PageSeoFields` carry the facts a rich result
  requires** and the SEO group does not: author and `datePublished` for an
  article, `startDate` and a location for an event. A node without them is valid
  schema and ineligible for the result it was written for.
- **Breadcrumbs are derived from the URL** unless the caller passes
  `breadcrumbTrail`. A leading two-letter segment is treated as a locale prefix
  and stays in the URLs without becoming a crumb — `sv` is not a step in the
  hierarchy. The last crumb gets no `item`, per schema.org.
- `customSchemaJson` is still merged in as an extra node, and invalid JSON is
  still logged and ignored rather than thrown.

## Block level

Two mechanisms, because blocks come in two kinds.

**Blocks whose data is in the composition** are collected by
`collectBlockSchema(nodes)`, which walks the tree the route already fetched and
returns `{ faqItems, nodes }`. It replaced a walker that read `OT_AccordionBlock`
alone.

| Block | Node |
|---|---|
| `OT_AccordionBlock`, `OT_FaqBlock` | `FAQPage` — both feed one node; the first nests items, the second holds parallel `questions`/`answers` arrays |
| `OT_VideoBlock` | `VideoObject`, with a YouTube thumbnail derived from the id |
| `OT_ImageBlock` | `ImageObject` — **only when the image has a caption** |
| `OT_QuoteBlock` | `Quotation` |

**Blocks that fetch their own data** cannot be seen from the tree — the
composition holds their configuration only. They emit their own `<JsonLd>` from
their server adapter:

| Adapter | Node |
|---|---|
| `cms/components/OT_EventListingBlock.tsx` | `ItemList` of `Event`, matching the block's type filter and max items |
| `cms/components/OT_LocationListingBlock.tsx` | `ItemList` of `LocalBusiness`, with `geo` when the adapter's geocoding resolved coordinates |

What is deliberately **not** emitted, and why:

- **No node per card, stat or table.** Structured data describes a page to a
  machine; it is not a mirror of the markup. Nodes that carry no distinct meaning
  are noise a validator eventually flags.
- **No `Review` from `OT_QuoteBlock`.** The block has no rating and no reviewed
  item. A `Review` without either is the kind of claim that earns a manual action
  rather than a rich result — hence `Quotation`.
- **No `ImageObject` for uncaptioned images.** A decorative image says nothing
  worth indexing.
- **No Vimeo thumbnail.** It needs an API call, and a guessed URL is worse than
  an absent one.

## Checking the output

```bash
curl -s https://lnsfrskringar-demo.vercel.app/blog/<slug> \
  | python3 -c "import sys,re,json; \
      print(json.dumps(json.loads(re.search(r'application/ld\+json[^>]*>(.*?)</script>', sys.stdin.read(), re.S).group(1)), indent=2))"
```

Then paste it into the [Rich Results Test](https://search.google.com/test/rich-results)
or the [schema.org validator](https://validator.schema.org/). A page with an
accordion, a captioned image and a quote should return Organization, WebSite,
BreadcrumbList, the page node, FAQPage, ImageObject and Quotation.
