# Länsförsäkringar Stockholm — Optimizely SaaS CMS Demo

A working demo site for **Länsförsäkringar Stockholm (LF)**, built on the
**Site Accelerator** framework: Next.js App Router front end, all content served
headlessly from the **Optimizely SaaS CMS** through **Optimizely Graph**, all
assets from **Optimizely DAM**.

The point of the demo is to answer LF's architecture questions with something
running rather than with slides — channel-agnostic content delivery, a single
source of truth for assets, and editors composing pages themselves in Visual
Builder.

**Live:** https://lnsfrskringar-demo.vercel.app
**CMS instance:** `lans01saas` (Production1)

---

## Stack

| | |
|---|---|
| **Next.js 16.2.6** | App Router, TypeScript, no Pages Router |
| **React 19.2.4** | |
| **Tailwind CSS v4** | `@import "tailwindcss"` in `app/globals.css`; tokens in `styles/tokens.css` — there is no `tailwind.config.*` |
| **@optimizely/cms-sdk** | headless content client (Graph) |
| **@optimizely/cms-cli** | pushes TypeScript content-type definitions to the CMS |

The front end holds **no content** — only rendering. A published experience
reaches the browser purely as a Graph query result.

---

## Quick start

```bash
yarn install
yarn dev          # http://localhost:3000
```

You need `.env.local` first (see below). Without `OPTIMIZELY_GRAPH_SINGLE_KEY`
every CMS-driven route 404s.

### Commands

| Command | What it does |
|---|---|
| `yarn dev` | Dev server |
| `yarn build` | Production build |
| `yarn lint` | ESLint |
| `yarn lint:tokens` | Flag hard-coded colors that should be design tokens |
| `yarn cms:push` | Push content types / display templates to the CMS |
| `yarn cms:pull` | Pull the CMS content-type config back down |

The CLI does not read `.env` files itself, so these are wrapped: `cms:push` goes
through `scripts/cms-push.mjs`, while `cms:pull` passes
`--env-file=.env.<current-git-branch>` — on `main` that means a `.env.main` file,
not `.env.local`.

### Environment variables

```bash
# .env.local (dev) — and the same set in Vercel project settings (production)

OPTIMIZELY_GRAPH_SINGLE_KEY=    # public content queries — the app needs this
OPTIMIZELY_GRAPH_APP_KEY=       # not read by the app; app key + secret as Basic
OPTIMIZELY_GRAPH_SECRET=        #   auth is how you query DRAFTS by hand, which
                                #   the single key cannot see

OPTIMIZELY_CMS_URL=             # https://app-xxx.cms.optimizely.com/
OPTIMIZELY_CMS_CLIENT_ID=       # OAuth client for content-type sync + REST writes
OPTIMIZELY_CMS_CLIENT_SECRET=

OPTIMIZELY_CMS_API_URL=         # optional; the REST gateway the Opal writer
                                #   posts to. Defaults to api.cms.optimizely.com.
                                #   NOT the same as OPTIMIZELY_CMS_URL above,
                                #   which is the CMS *UI* host

CMP_CLIENT_ID=                  # Optimizely CMP / DAM — asset lookups
CMP_CLIENT_SECRET=

NEXT_PUBLIC_SITE_URL=           # canonical origin, no trailing slash
NEXT_PUBLIC_OPTIFORMS_ENABLED=  # 'true' only on instances that have Forms

OPAL_TOOL_SECRET=               # bearer token for /api/opal/dam-images and
                                #   /api/opal/create-blog. Both FAIL CLOSED —
                                #   unset means every request is refused rather
                                #   than running unauthenticated.
                                #   /api/opal/discovery is public by design
CMS_BLOG_CONTAINER_KEY=         # Blog folder new articles are created under

CMP_CALLBACK_SECRET=            # shared secret on the CMP webhooks. Also fails
                                #   closed: /api/cmp-preview and /api/cmp-publish
                                #   answer 503 without it
CMP_BLOG_CONTAINER_KEY=         # container /api/cmp-publish writes into. NO
                                #   fallback — one character from the CMS_ one
                                #   above, and a different thing

KV_REST_API_URL=                # Vercel KV. The CMP preview flow needs a durable
KV_REST_API_TOKEN=              #   store: CMP fetches the completed preview URL
                                #   later, on a different serverless instance
```

> `NEXT_PUBLIC_*` values are inlined at **build** time. Changing one in Vercel
> and restarting is not enough — it needs a fresh build, without the build
> cache. A stale `NEXT_PUBLIC_SITE_URL` is how `robots.txt` came to advertise
> `http://localhost:3000/sitemap.xml` from production.

> `.env*` is gitignored. The build scripts read credentials from `.env.local` —
> never hardcode them, the scripts live in the repo.

---

## How the CMS side is built

The CMS content is **scripted, not hand-authored**, so the whole site can be
torn down and rebuilt. Graph is read-only, so writes go through the Content
Management REST API.

| Script | Builds |
|---|---|
| `scripts/rebuild_lf_home_vb.py` | The home experience — 9 named sections, 35 blocks. `--dry-run` prints the tree without writing. |
| `scripts/build_lf_chrome.py` | Header, footer and ThemeManager |

```bash
python3 scripts/rebuild_lf_home_vb.py --dry-run   # inspect
python3 scripts/rebuild_lf_home_vb.py             # publish a new version
```

### Composition shape

Visual Builder's Outline lists **sections**, so every block must be nested.
Flat component nodes directly under the experience render fine but are invisible
to the editor:

```
experience  (layoutType: outline)
  section   (layoutType: grid, component: BlankSection, displayName: "Hero")
    row
      column
        component   ← the block
```

Two constraints worth knowing before adding blocks:

- Only `elementEnabled` blocks may sit in a column. `sectionEnabled`-only types
  (e.g. `OT_FeatureGridBlock`) are rejected in **both** positions.
- Sections need `displayName`, or every row of the Outline reads
  *"Blank Section"*.

### Assets

Every asset comes from **DAM**, referenced from the CMS exactly like CMS media —
`cms://content/{assetKey}`. The `graph://cmp/...` form is rejected. The CMS
stores the reference back as `cms://content/DamImageSource/{key}`, and Graph
hands the front end an `images3.cmp.optimizely.com` URL.

Image delivery goes through a custom loader (`lib/imageLoader.ts`), not Vercel's
optimizer. The DAM CDN resizes via a **`width`** query param — and only that one;
`w`, `fm`, `format`, `quality` and friends are silently ignored.

---

## Blog, and writing one from Opal

Articles live in **Root > Blog** as `BlankExperience` documents — the same
sections and blocks as every other page, so an article stays editable in Visual
Builder rather than being locked into a fixed template.

Two tools let Optimizely Opal write one on request:

| Tool | |
|---|---|
| `list_dam_images` | lists the DAM library so Opal picks a real image key instead of inventing one |
| `create_blog_article` | describes an article in sections; the tool builds the composition |

Articles are created as **drafts**, always. Anything a language model can
trigger should land where a person confirms it before the public sees it.

```
/blog                    index of published articles (a code route)
/blog/<slug>             an article
/api/opal/discovery      the tool manifest Opal reads
```

Fifteen section types are available — text, steps, accordion, table, stats,
quote, callout, image, imageText, gallery, banner, video, cards, links, divider.

Setup, the section vocabulary, the Opal skill that stops Opal reaching for its
own CMS tools, and how to verify any of it: [`docs/blog-and-opal.md`](docs/blog-and-opal.md).

---

## Integration status

The sequence LF asked for, and where it actually stands:

| | Status |
|---|---|
| **CMS ↔ Graph** — headless delivery | ✅ Done |
| **CMS ↔ DAM** — single source of truth for assets | ✅ Done |
| **Visual Builder** — section + block editing | ✅ Done |
| **CMP ↔ CMS/DAM** | 🟡 Asset half live; webhooks wired and verified, campaign planning not |
| **Forms ↔ CMS** | ⬜ Content types registered behind `NEXT_PUBLIC_OPTIFORMS_ENABLED` |
| **CMS ↔ Experimentation** | ⬜ Not started |
| **Opal** in an editorial workflow | ✅ Two tools + a skill; Opal writes an article into the Blog folder as a draft |
| **Micro frontend** proof point | ⬜ Not started |
| **Databricks-native analytics** | ⬜ Not started |
| **Azure Front Door** answer | ⬜ Not started |

---

## Gotchas hit while building this

Each of these cost real time, so they are written down rather than rediscovered.

- **Locale prefix.** The front end declares four locales (`en`, `es`, `fr`, `de`
  in `i18n/routing.ts`), but what matters here is the **CMS instance**: several
  locales are enabled on it and none is marked default, so Graph indexes English
  at `/en/` rather than `/`, and every request for `/` returned 404 while the
  header and footer still rendered — they read ThemeManager directly, so it
  looked like a routing bug. `getLocalizedContentByPath` tries the bare path,
  then the prefixed one.
- **`frontEndDomain` must match the deployed host.** ThemeManager is matched by
  host; when it held `localhost:3000` the header and footer fell back to their
  hardcoded defaults on Vercel while the page body rendered normally. A single
  ThemeManager now resolves on any host, which also covers preview URLs.
- **`POST /versions` creates a version from the payload alone.** Send a partial
  property set and everything you omitted is blanked. Always re-post all
  properties. `displayName` is required, and the response body is empty — the
  new version number arrives in the `Location` header.
- **The versions list is not sorted.** `items[-1]` is not the latest; filter on
  `status`.
- **API access is two layers.** `api:admin` scope only opens the API. Read/write
  on a content item is granted separately per item under Settings → Set Access
  Rights. Symptom: `/contenttypes` returns 200 while `POST /v1/content` returns
  403.
- **Empty `allowedTypes` is not "any type".** The SDK's `resolveAllowedTypes`
  falls back to *every* cached content type, generating a query across ~70 types
  that Graph rejects. Image references stay narrowed to `['_image']`.
- **Graph indexing lags** a few minutes behind a publish. Visual Builder 404s
  until it catches up.
- **A DAM reference is not a CMS media reference.** CMS media is
  `cms://content/<key>`; a DAM asset needs `cms://content/DamImageSource/<key>`.
  Without the segment the CMS accepts the value and the block renders with no
  image and no error.
- **Graph rejects `limit` above 100** rather than clamping it, failing the whole
  query. `sitemap.ts` asked for 200 and served an empty `<urlset>` for weeks
  because a bare `catch` turned the error into silence.
- **The CMS drops empty strings from a string array.** Six cells go in, five
  come back, and a table rebuilt from `columnLabels.length` shifts every later
  value into the wrong column. Pad with a visible placeholder.
- **Opal caches a tool manifest at registration** and never re-reads it. Adding
  a tool means deleting the registry and creating it again.

---

## Project docs

| Doc | Covers |
|---|---|
| [`PRODUCT.md`](PRODUCT.md) | Product purpose, users, brand voice |
| [`DESIGN.md`](DESIGN.md) | Color strategy, typography, elevation, motion |
| [`Optimizely.md`](Optimizely.md) | CMS integration patterns, page types, Graph queries, and the full gotcha list |
| [`CLAUDE.md`](CLAUDE.md) | Repo conventions and the block-authoring workflow |
| [`docs/blog-and-opal.md`](docs/blog-and-opal.md) | The blog, both Opal tools, the section vocabulary, setup and verification |
| [`docs/opal-skills/`](docs/opal-skills/) | Importable Opal skills, and what to set in Opal after importing |

For any work under `cms/` or `components/blocks/`, the **optimizely-block**
skill (`.claude/skills/optimizely-block/`) encodes the four-layer + showcase +
push workflow and the seven artifacts each block needs to be complete.

`/showcase` is a live gallery of every block and layout plus a theme playground —
the fastest way to see what exists.
