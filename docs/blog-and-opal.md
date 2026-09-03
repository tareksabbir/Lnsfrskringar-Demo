# Blog, and writing one from Opal

Articles live in a CMS folder, are composed of the same blocks as every other
page, and can be written by Optimizely Opal on request. This is the whole of it —
the CMS shape, the two tools, the section vocabulary, and the setup.

- **Live index:** https://lnsfrskringar-demo.vercel.app/blog
- **CMS location:** Root > Blog (`1330a97ad221400d8048329cda2ca918`)

---

## How an article is stored

An article is a **`BlankExperience`**, not `OT_BlogPage`.

That is deliberate. `OT_BlogPage` is a `_page` type rendered by a fixed React
component; a `BlankExperience` carries a composition, so an article is built from
the same sections and blocks as the home page and stays editable in Visual
Builder. An editor can restructure an article Opal wrote without touching code.

The cost is that `OT_BlogFeedBlock` — which queries `OT_BlogPage` — lists none of
these. Hence the index below.

```
Root
└── Blog                          OT_FolderPage, routeSegment "blog"
    └── the-road-to-a-…           BlankExperience  →  /blog/the-road-to-a-…
```

A folder lends its segment to a child's URL but is not itself a page, so `/blog`
would 404 without a route of its own.

## `/blog` — the index

`app/(site)/blog/page.tsx`, backed by `lib/blogIndex.ts`. A code route, not a CMS
page, for two reasons: the feed block would list nothing (above), and a listing
derived from Graph needs no authoring step — an article Opal writes at 3am
appears the moment someone publishes it.

The trade-off is stated in the file: **this index is not editable in Visual
Builder.** The articles it links to still are.

`lib/blogIndex.ts` asks Graph for nothing unproven — every field is copied from
the site-search query, which runs against the live index. It deliberately does
not request `noIndex`, `orderBy`, or `url { hierarchical }`, and does not scope
by `url.base`; sorting and the `/blog/` path filter run in JS where they cannot
fail. The reasoning is in the file, and it is the same reasoning that would have
prevented the empty-sitemap bug.

One detail that cost a round trip: Graph returns paths with the default locale
prefix (`/en/blog/…`), so the filter looks for a `blog` segment anywhere in the
path rather than requiring the path to start with `/blog/`.

---

## The two Opal tools

Discovery manifest: `app/api/opal/discovery/route.ts` — public, unauthenticated,
a description of the interface rather than a way to use it. Both tools it
advertises require a bearer token.

### `list_dam_images`

`app/api/opal/dam-images/route.ts` → `lib/damImages.ts`

Returns each DAM image's `key`, `title` and CDN `url`. Opal calls this first and
passes a returned `key` as `imageKey`.

Called a listing rather than a search on purpose. Graph does index `cmp_Asset`
with `_fulltext`, but the library's titles are original filenames like
`charles-forerunner-3fPXt37X6UQ-unsplash.jpg`, so a query for "house" matches
nothing — not because the picture is absent but because nothing describes it.
Give the assets real titles or tags in CMP and the filter starts earning its
name.

It is behind the same bearer check as the writing tool: an open endpoint that
enumerates a customer's media library is an inventory of it.

### `create_blog_article`

`app/api/opal/create-blog/route.ts` → `lib/blogComposition.ts`

Takes a description of an ARTICLE — title, intro, a list of sections — and
builds the composition. The caller never has to know how an Optimizely
composition is shaped; every trap met building the product pages by hand lives
in `lib/blogComposition.ts` instead of in a prompt.

Articles are created as **drafts**, always. Anything a language model can
trigger should land where a person confirms it before the public sees it, and
"publish straight to the live site" is not a decision this endpoint should be
able to make. The response carries the `container` it wrote to, which is also
the fingerprint proving this tool ran rather than a built-in one.

---

## Section vocabulary

Fifteen types. Each maps to blocks that are actually placeable in a column —
`sectionEnabled`-only types holding arrays of components are not, and would be
accepted by the CMS then render nothing.

| Type | Renders as | Notes |
|---|---|---|
| `text` | `OT_PrimaryTextBlock` / `OT_RichTextBlock` | `body` takes simple HTML |
| `steps` | rich text `<ol>` | a list, not cards — numbering stays right |
| `accordion` | `OT_FaqBlock` | parallel string arrays, not child components |
| `table` | `OT_CompareTable` | flat row-major cells |
| `divider` | `OT_DividerBlock` | |
| `image` | `OT_ImageBlock` | |
| `imageText` | `OT_ImageBlock` | its own 2-column layout, triggered by `heading`/`body` |
| `gallery` | up to 3 × `OT_ImageBlock` | |
| `quote` | `OT_QuoteBlock` | |
| `callout` | `OT_CalloutBlock` | body capped at 200 |
| `stats` | up to 4 × `OT_CardBlock` | **not** `OT_StatBlock` — see below |
| `banner` | `OT_BannerBlock` | |
| `video` | `OT_VideoBlock` | YouTube/Vimeo only; anything else is dropped |
| `cards` | up to 3 × `OT_CardBlock` | |
| `links` | rich text list | |

`stats` renders as cards because `OT_StatBlock` declares only `sectionEnabled`
and holds an array of `OT_StatItem` components, making it unplaceable inside a
column. A card with the figure as its heading is the honest approximation
available.

An unknown or malformed section is **skipped**, not fatal. A slightly-wrong
payload from a model still produces a page.

### Width

Every section takes one width, set by `ARTICLE_WIDTH` in
`lib/blogComposition.ts`. Sections used to pick their own — prose at `narrow`
(896px), cards and tables at `default` (1440px) — so the left edge moved every
few sections and a long article read as three documents stacked up.

A middle width, `article` (1024px), exists in `cms/compositions/Section.tsx` and
in the pushed `OT_LandingSection` template. It is available per section in
Visual Builder but is not the default: it was tried on a real article and read
too loose.

---

## The Opal skill

`docs/opal-skills/lf-stockholm-blog-articles/` — importing instructions are in
[`docs/opal-skills/README.md`](opal-skills/README.md).

Without it, Opal reaches for its own built-in CMS tools and produces a page
outside the Blog folder that the site cannot render. The skill pins blog writing
to `create_blog_article`, requires image keys to come from `list_dam_images`, and
tells Opal to stop rather than substitute a tool if ours is unavailable.

Two fields the skill file cannot carry, both set in Opal after import:

- **Where to use** — Content Management System, `lans01saas: Production1`.
  Without it the skill applies to every instance.
- **Activation Trigger** — keyword and intent matching. The tool-based
  alternative fires only once a tool is in use, too late to influence which tool
  is chosen.

The manifest's own tool description does the same job independently, so a
missing skill is not fatal. Both exist because either one can be missed.

---

## Setup

### Environment

```bash
OPAL_TOOL_SECRET=          # bearer token for /api/opal/dam-images and
                           #   /api/opal/create-blog. Both FAIL CLOSED: unset
                           #   means every request is refused. /api/opal/discovery
                           #   is public by design and does not read this.
CMS_BLOG_CONTAINER_KEY=    # Blog folder. Unset falls back to the folder's own
                           #   key, hardcoded in the route.
```

`create_blog_article` also needs `OPTIMIZELY_CMS_CLIENT_ID` / `_SECRET` — it
writes through the Content Management REST API — and honours
`OPTIMIZELY_CMS_API_URL` if the gateway ever moves.

Generate the secret with:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

The same value goes in Vercel and in the Opal registry's Bearer Token field.
Set it in Vercel and **redeploy** before registering the tool, or the first
delivery answers 503 and the registry looks broken.

### Registering the tools

**Opal → Connectors → Registries → Add tool registry** (the menu is Connectors,
not Tools — it was renamed).

| Field | Value |
|---|---|
| Registry Name | LF site — blog |
| Discovery URL | `https://lnsfrskringar-demo.vercel.app/api/opal/discovery` |
| Bearer Token | the `OPAL_TOOL_SECRET` value |

Opal reads the manifest **once, at registration**, and does not re-read it. After
changing the manifest, delete the registry and create it again, or register a new
one with a cache-busting query string. Every fetch is logged as
`[opal/discovery]`, so the absence of a line means Opal never came.

### Verifying

```bash
TOKEN='…'
curl -s -X POST https://lnsfrskringar-demo.vercel.app/api/opal/create-blog \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"parameters":{"title":"Smoke test","sections":[{"type":"text","body":"<p>ok</p>"}]}}'
```

| Response | Meaning |
|---|---|
| `200` with `container` | working |
| `401` | token differs between Vercel and the caller |
| `503` | `OPAL_TOOL_SECRET` unset — or the CMS credentials are, which is the same status for a different reason. The error body says which. |
| `400` | payload shape — the log prints field names and types |

From Opal, the test is the presence of `container` in the raw response. It is
absent when a built-in tool ran.

---

## Related files

| Path | |
|---|---|
| `lib/blogComposition.ts` | section → composition, and every CMS trap |
| `lib/blogIndex.ts` | the `/blog` listing query |
| `lib/damImages.ts` | DAM listing, and the `DamImageSource` reference format |
| `lib/opalAuth.ts` | bearer check + Opal's parameter envelope, shared by both tools |
| `app/(site)/blog/page.tsx` | the index page |
| `scripts/emit_section_probe.mts` | builds an article using every section type |
