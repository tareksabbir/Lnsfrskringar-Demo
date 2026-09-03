# Optimizely SaaS CMS — Architecture Guide

This document explains how Optimizely SaaS CMS is integrated into this Next.js project: how content types, display templates, and components relate to each other, how GraphQL is used to fetch content, and how the preview system works. Read this before adding any new CMS-driven content.

---

## Mental model

The CMS and the front end share a contract expressed in TypeScript. Editors work in the Visual Builder; content is stored in the CMS and delivered over Optimizely Graph (a GraphQL API). The Next.js app queries that API, resolves each piece of content to a React component, and renders it.

There are four distinct layers for every content block:

```
Content Type  →  Display Template  →  CMS Adapter  →  React Component
(schema)         (settings schema)    (cms/components)  (components/blocks)
```

Every layer has a specific responsibility and they must all stay in sync.

---

## Environment variables

| Variable | Used by | Purpose |
|---|---|---|
| `OPTIMIZELY_GRAPH_SINGLE_KEY` | `lib/optimizely.ts` | Single-key for all public Graph queries |
| `OPTIMIZELY_CMS_URL` | Preview routes, layout | Base URL of the CMS instance (e.g. `https://app-xyz.cms.optimizely.com`) |
| `OPTIMIZELY_CMS_CLIENT_ID` | `cms-cli` only | OAuth client for pushing content type definitions |
| `OPTIMIZELY_CMS_CLIENT_SECRET` | `cms-cli` only | OAuth client secret |
| `NEXT_PUBLIC_OPTIFORMS_ENABLED` | `cms/registry.ts` | `'true'` registers the OptiForms content types, display template, and adapters. Leave unset on any instance without Optimizely Forms — see the OptiForms section below |

`OPTIMIZELY_GRAPH_SINGLE_KEY` is the only key required at runtime for the front end. The CLI credentials are only needed when running `yarn cms:push` to sync content type definitions to the CMS. The CLI does not load `.env` files itself — the `cms:push` wrapper resolves `.env.<branch>`, falling back to `.env.local`, and passes it in.

---

## SDK initialization (`lib/optimizely.ts` + `cms/registry.ts`)

The root layout (`app/layout.tsx`) imports both files at the top:

```ts
import '@/lib/optimizely'   // configures the SDK with the Graph single key
import '@/cms/registry'     // registers all content types, display templates, and React components
```

These imports run once on server startup. Nothing else in the app needs to call the SDK initializers.

### `lib/optimizely.ts`

Calls `config({ apiKey })` from `@optimizely/cms-sdk` exactly once (guarded by an `initialized` flag). Exports:

- `getClient()` — returns the initialized Graph client; used everywhere content is fetched
- `getSiteSettings(domain, locale)` — fetches the `OT_ThemeManager` instance whose `frontEndDomain` matches `domain` **exactly**. If nothing matches, it falls back to the single ThemeManager only when exactly one exists; with several, an unmatched host returns `null` and the caller renders its default tokens. The asymmetry is deliberate: on a multi-site instance serving the wrong brand is worse than serving none, but one ThemeManager is unambiguously the site's theme. That fallback is also the only thing that makes deployed hosts work — `frontEndDomain` typically holds `localhost:3000`, and Vercel preview URLs carry a fresh hash per deployment, so they can never be registered in advance. The underlying fetch is wrapped in React `cache()` (keyed by locale) so Header, Footer, and layout all share a single Graph round-trip per request.
- `getSiteKey(locale)` — the matched ThemeManager's `frontEndDomain`, used as the site filter for records that have no URL of their own (`OT_PractitionerProfile`, `OT_LocationProfile`) on a shared CMS instance
- `buildThemeCSS(settings)` — converts ThemeManager color values and theme axes into inline CSS custom property overrides
- `getLocalizedContentByPath(path, locale, baseUrl?, variationSlug?)` — the locale-aware page/experience lookup used by both the home route and the catch-all (see **Locales and i18n** below)
- `setRequestContext(locale)` — calls the SDK's `setContext({ locale })` so composition rendering and preview attributes know the active locale
- `getRequestLocale()` — the locale resolved by the next-intl middleware, falling back to `DEFAULT_LOCALE` on routes the middleware skips (`/preview`, `/api/*`)
- `getRequestDomain()` — reads the `Host` header from the Next.js request context, port included
- `getRequestBaseUrl()` — protocol + host for the current request (honours `x-forwarded-proto`), passed to Graph as the `host` filter so queries resolve against the right site channel

Every Graph call in this file goes through `withGraphResilience`, a private wrapper that races the request against a 12 s timeout and retries once. It exists because a stalled `fetch` (undici's `UND_ERR_HEADERS_TIMEOUT`) otherwise hangs the page for minutes.

### `cms/registry.ts`

Calls three SDK functions:

- `initDisplayTemplateRegistry([...])` — tells the SDK which display templates exist and what settings they expose
- `initContentTypeRegistry([...])` — tells the SDK what fields each content type has so it can build the correct GraphQL fragment when fetching compositions
- `initReactComponentRegistry({ resolver: createTokenAwareResolver({...}) })` — maps content type keys (e.g. `"OT_HeroBlock"`) to the React adapter components that render them

All three registries must stay in sync with each other and with the `optimizely.config.mjs` file. Missing entries cause silent render failures.

### The token-aware resolver layer (`lib/with-tokens.ts`)

The resolver map is not handed to the SDK raw — it is passed through `createTokenAwareResolver`, which wraps every adapter in the map with one async decorator. Before an adapter sees its `content` prop, the wrapper resolves the request's locale and domain, loads that site's token map (`getTokenMap` from `lib/tokens.ts`, populated from `OT_TokenManager`), and deep-replaces every `{{token-key}}` placeholder found in the content. When no tokens are defined the wrapper short-circuits and calls the adapter untouched, so the cost is one cached lookup per request rather than per block.

Practical consequences: adapters never handle token syntax themselves, and any adapter added to the resolver map gets token substitution for free. Anything rendered *outside* the resolver — Header, Footer, the `_page` components fed by `lib/` queries — does not, and must apply `lib/token-replace.ts` itself if it needs it.

---

## Content types (`cms/content-types/`)

A content type is a TypeScript-declared schema that defines what fields editors can fill in. It maps exactly to what the CMS stores and what the Graph API returns.

```ts
export const OT_HeroBlock = contentType({
  key: 'OT_HeroBlock',          // unique identifier — must match everywhere
  displayName: 'Hero Block',    // label editors see in the CMS
  baseType: '_component',       // what kind of content this is (see below)
  compositionBehaviors: ['elementEnabled', 'sectionEnabled'], // where it can appear
  properties: {
    headline: { type: 'string', displayName: 'Headline', group: 'OT_Content', sortOrder: 20 },
    visual:   { type: 'contentReference', allowedTypes: ['_image'], ... },
    primaryCtaUrl: { type: 'url', ... },
  },
})
```

### Base types

| `baseType` | Meaning |
|---|---|
| `_component` | A reusable block of content — the most common type. Can be standalone (shared content) or placed inside an experience. |
| `_experience` | A page composed in the Visual Builder. Contains a composition tree (sections → rows → columns → blocks). |
| `_page` | A traditional CMS page with a URL, rendered by a dedicated React component instead of a composition. Five exist here — see **Existing `_page` types**. |
| `_image`, `_video` | Built-in media types. Used as `allowedTypes` constraints on `contentReference` fields. |

### Property types

| `type` | GraphQL shape | Notes |
|---|---|---|
| `string` | plain scalar | Also supports `format: 'selectOne'` with an `enum` list for dropdowns |
| `richText` | `{ html, json }` | Full rich-text editor (TinyMCE). Access `.json` in adapters and render with `<RichText content={content.body?.json ?? undefined} />` from `@optimizely/cms-sdk/react/richText`. Never use `.html` with `dangerouslySetInnerHTML`. |
| `url` | `InferredUrl` object | Shape: `{ default, hierarchical, internal, graph, base, type }` — all string or null. Use `content.myField?.default` for the plain URL string. Never treat this as a plain string; accessing it as `String(content.myField)` will give `[object Object]`. |
| `contentReference` | `InferredContentReference` object | Shape: `{ url: InferredUrl, item, key }`. Use `src(field)` from `getPreviewUtils` to extract the URL, or access `.url?.default` directly. For content references that have sub-item metadata (e.g. `articleRoot`), the URL is at `.url?.hierarchical`, not `._metadata.url`. |
| `link` | `{ text, title, target, url: InferredUrl }` | For CTAs and navigation links. The href is `field?.url?.default`; always add `rel="noopener noreferrer"` when `target === '_blank'`. |
| `boolean` | plain scalar | |
| `integer` | plain scalar | |
| `json` | plain scalar | Stored and returned as a raw JSON string — parse on the client |
| `array` | array of items | Items can be `{ type: 'component', contentType: SomeType }` for nested structured content |

### Property definition rules — SDK type constraints

These are non-obvious constraints enforced by the SDK's TypeScript types. Violating them produces build errors.

- **Enum `value` not `key`**: dropdown items must be `{ value: 'foo', displayName: 'Foo' }`, not `{ key: 'foo' }`.
- **Flat validation**: `maxLength` is a top-level property field — there is no `validation: {}` wrapper object.
- **`isLocalized` not `localized`**: the localization flag is `isLocalized: true`.
- **`required` is unsupported**: the SDK types do not include a `required` field — omit it.
- **`xhtml` does not exist**: rich text is `type: 'richText'`, not `type: 'xhtml'`.

### Controlling child content types (`mayContainTypes`)

`_page`, `_experience`, and `_folder` content types can declare which child content types editors are allowed to create inside them in the CMS tree. Without this, the CMS defaults to "None" and editors cannot add child pages.

```ts
export const BlankExperience = contentType({
  key: 'BlankExperience',
  baseType: '_experience',
  mayContainTypes: ['*'],   // all child content types allowed
  ...
})
```

`BlankExperience` and `OT_FolderPage` both use `['*']`. To narrow the list instead, `mayContainTypes` accepts an array of `ContentType` references or string keys — plus `'_self'` for "same type as me". Prefer string keys over imports when two files would otherwise circularly import each other.

### Composite/nested content types

Some content types exist purely as structured sub-items inside an array field — they are never placed independently. Examples: `OT_NavigationItem`, `OT_NavigationSubItem`, `OT_FooterLink`, `OT_FooterColumn`. These must still be registered in `initContentTypeRegistry` so the SDK can build GraphQL fragments for them.

### The ThemeManager (`OT_ThemeManager`)

A special `_component` block that acts as site-wide configuration. It is stored in CMS Shared Content (not in a page tree or experience). The front end queries all ThemeManager instances, then filters by `frontEndDomain` to find the right one for the current deployment. Fields cover:

- `frontEndDomain` — the hostname this theme belongs to (port included; no scheme)
- Logo (`contentReference` narrowed to `['_image']`) + `logoFit`, `logoAlt`, `logoInvertDark`
- `defaultMode` — initial color mode (dark/light)
- Header CTA (`ctaLabel` + `ctaUrl`)
- `searchScope` — whether site search covers this site only or every site on the instance
- `primaryNavigation` (array of `OT_NavigationItem`)
- `utilityNav` (array of `OT_NavigationItem`, max 4) — the slim persona/segment bar above the main header; the bar renders only when at least one item is set
- `footerRef` (a `contentReference` to `OT_FooterBlock`) + `copyright`. There is **no** footer-columns array and no legal-links field on ThemeManager — columns, bottom links, and the footer description all live on the referenced `OT_FooterBlock`.
- Color overrides for **14** CSS custom properties in `styles/tokens.css`: `colorBrand`, `colorBrandHover`, `colorAccent`, `colorAccentHover`, `colorFgOnAccent`, `colorCanvas`, `colorSurface`, `colorCanvasLight`, `colorSurfaceLight`, `colorFgOnBrand`, `colorFg`, `colorFgLight`, `colorFgMuted`, `colorFgMutedLight`
- Four non-color **theme axes**, stored as option keys only (the vetted CSS values live in `lib/theme-axes.ts`): `cornerStyle`, `primaryFont`, `motionIntensity`, `navbarStyle`. Every axis defaults to current behaviour, so unset means unchanged.
- SEO group (`OT_SEO`): `siteName`, `defaultSeoDescription`, `defaultSocialImage`, `twitterHandle`, `organizationDescription` — consumed by `lib/metadata.ts` and `lib/structured-data.ts`
- Integrations group (`OT_Integrations`): `webExperimentationProjectId`, `featureExperimentationSdkKey`, `odpPublicKey`, `peeriusScriptUrl`, `contentRecsApiKey`, `contentRecsClientId`, `contentRecsDeliveryId`, `googleAnalyticsId` — third-party account IDs resolved per domain so different deployments target different accounts without env-var changes

Color overrides use raw CSS values (hex, `oklch(...)`, `hsl(...)`, etc.). If a field is blank the token falls back to the value in `styles/tokens.css`. `buildThemeCSS()` converts populated colors *and* the resolved theme axes into an inline `<style>` tag injected in `<head>` before first paint, emitting into `:root`, `[data-theme="dark"]`, and `[data-theme="light"]` blocks so nested dark surfaces inside a light page still pick up the right values.

---

## Display templates (`cms/display-templates/`)

A display template defines the **visual presentation options** for a content type or a composition node. These are the settings panels editors see in the Visual Builder sidebar — things like background color, layout direction, column width, spacing, etc.

```ts
export const OT_HeroDefault = displayTemplate({
  key: 'OT_HeroDefault',
  displayName: 'Hero Default',
  contentType: 'OT_HeroBlock',   // which content type this template belongs to
  isDefault: true,               // the CMS uses this if no template is explicitly chosen
  settings: {
    layout: {
      displayName: 'Panel layout',
      editor: 'select',
      choices: {
        imageRight: { displayName: 'Image Right (Default)' },
        imageLeft:  { displayName: 'Image Left' },
      },
    },
    color: { ... },
    animation: { ... },
  },
})
```

Display templates do not contain content — they only carry **how** to render the content. The SDK passes the selected choices as a `displaySettings` object to the React adapter at render time.

### Composition display templates (Section / Row / Column)

The Visual Builder composes pages from sections, which contain rows, which contain columns, which contain blocks. Each structural node has its own display template:

| Template | `baseType` / `nodeType` | Purpose |
|---|---|---|
| `OT_LandingSection` | `baseType: '_section'` | Controls width, vertical spacing, min-height, background color of a section |
| `OT_LandingRow` | `nodeType: 'row'` | Controls flex direction, gap, alignment, background, entrance animation |
| `OT_LandingRowSlider` | `nodeType: 'row'` | Non-default row variant (`isDefault: false`) — renders the row's columns as a horizontal slider. Editors pick it per row from the row's template dropdown. |
| `OT_LandingColumn` | `nodeType: 'column'` | Controls column span (1–12), padding, alignment |

**Important:** `_section` uses `baseType`, not `nodeType`. Only `'row'` and `'column'` are valid `nodeType` values. Using `nodeType: 'section'` was a past bug — the display template must use `baseType: '_section'` to be recognized by the SDK.

---

## CMS adapter components (`cms/components/`)

Adapters are the bridge between what the CMS returns and what the React component needs. They are registered in `initReactComponentRegistry` and called by the SDK automatically when the composition renderer encounters their content type key.

Every adapter follows the same pattern:

```tsx
import { ContentProps } from '@optimizely/cms-sdk'
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import { OT_HeroBlock as OT_HeroBlockContentType } from '@/cms/content-types/OT_HeroBlock'
import { getHeroStyles } from '@/cms/styling/OT_HeroBlock.styling'
import HeroBlock from '@/components/blocks/HeroBlock'

type Props = {
  content: ContentProps<typeof OT_HeroBlockContentType>
  displaySettings?: Record<string, string | boolean>
}

export default function OT_HeroBlock({ content, displaySettings = {} }: Props) {
  const { pa, src } = getPreviewUtils(content)
  const styleOptions = getHeroStyles(displaySettings)

  return (
    <div {...pa(content.__composition)}>
      <HeroBlock
        headline={content.headline ?? ''}
        visualSrc={src(content.visual)}
        styleOptions={styleOptions}
        pa={pa}
      />
    </div>
  )
}
```

**Import aliasing:** The content type export name (`OT_HeroBlock`) collides with the adapter's default export function name. Always import the content type with a `...ContentType` alias: `import { OT_HeroBlock as OT_HeroBlockContentType }`.

**`ContentProps<typeof OT_HeroBlockContentType>`** generates a typed interface from the content type definition. Each property is typed according to its SDK property type — e.g. `string | null`, `InferredUrl | null`, `InferredRichText | null`. This catches incorrect field access at build time.

**Note on `displaySettings`:** This remains `Record<string, string | boolean>` because the styling helpers (`cms/styling/`) accept that broad type. The trade-off is intentional — updating the styling helper signatures to accept `ContentProps<typeof OT_HeroDefault>` would cascade changes through many files for little practical benefit.

**`getPreviewUtils(content)`** returns two helpers:

- `pa(fieldOrNode)` — "property attributes". When preview mode is active, returns `{ "data-epi-property-name": "fieldName" }` or `{ "data-epi-block-id": "..." }`, enabling the CMS overlay for on-page editing. In production it returns `{}`. Spread it onto the relevant DOM element.
- `src(contentReference)` — extracts `url.default` from a contentReference field. Returns `undefined` if the field is empty.

**`displaySettings`** is a flat `Record<string, string | boolean>` of the choices the editor made in the display template's settings panel. The adapter passes these to a styling helper (see below).

The outer `<div {...pa(content.__composition)}>` is the **block container** — it carries the block-level `data-epi-block-id` attribute. This is what the CMS uses to draw the selection overlay around the entire block. The inner `pa(fieldName)` calls mark individual editable properties.

---

## Styling helpers (`cms/styling/`)

One helper file per block translates the raw `displaySettings` object into the typed `styleOptions` structure the React component expects.

```ts
// cms/styling/OT_HeroBlock.styling.ts
export function getHeroStyles(s: Record<string, string | boolean>): HeroStyleOptions {
  return {
    layout:    (s.layout    ?? 'imageRight') as HeroStyleOptions['layout'],
    color:     (s.color     ?? 'brand')      as HeroStyleOptions['color'],
    animation: (s.animation ?? 'none')       as HeroStyleOptions['animation'],
  }
}
```

This layer exists to keep TypeScript-aware. `displaySettings` comes from the SDK as `Record<string, string | boolean>`; the styling helper casts the values to the correct union types and applies defaults, preventing those concerns from leaking into the pure React component.

---

## React block components (`components/blocks/`)

These are the actual visual components. They know nothing about the CMS. They receive typed props and render HTML + Tailwind classes using `cva` (class-variance-authority) for variant logic.

Every renderable prop that should be editable in-place has `pa` spread onto the element carrying that text or image:

```tsx
<h1 {...pa('headline')}>{headline}</h1>
<p  {...pa('body')}>{body}</p>
```

The `pa` function is threaded down from the adapter as a prop. In non-preview contexts it's a no-op `() => ({})`. This pattern means the React component stays pure and testable.

---

## Experiences and composition rendering

An **experience** is a page type built in the Visual Builder. There are two `baseType: '_experience'` types: `BlankExperience`, which most pages use, and `OT_PractitionerPage`, which pairs a locked `PractitionerHeader` (rendered outside the composition tree, from the referenced `OT_PractitionerProfile`) with a free composition below it.

When a page is fetched, the Graph API returns a `composition.nodes` tree. This project walks that tree with its own `<CompositionRenderer nodes={...} />` (`lib/CompositionRenderer.tsx`) rather than the SDK's `<OptimizelyComposition>`. It is a drop-in replacement — same prop, same output — and both the home route and the catch-all import it.

### Why `CompositionRenderer` and not `OptimizelyComposition`

Two reasons, both about root-level nodes:

1. **Display settings.** The SDK's `OptimizelyComposition` computes `parsedDisplaySettings` for `CompositionComponentNode` entries but forwards it only to the Wrapper, never to `OptimizelyComponent`. Blocks nested inside a section are fine (`OptimizelyGridSection` passes it correctly); a block placed directly at the experience root silently loses its configured display settings.

2. **Preview attributes.** `CompositionRenderer` also spreads `...pa(node)` onto every root node it renders, and that spread is the **only** source of `data-epi-block-id` — the sole thing Visual Builder uses to map a click in the preview back to a node in the Outline. An earlier version of this file omitted the spread, and the symptom was a page that rendered perfectly and responded to no clicks at all in VB.

`pa()` emits nothing unless `content.__context.edit` is true, and `__context` is attached **exclusively** by `getPreviewContent` (the SDK's graph client decorates the tree there). A page fetched through the ordinary published path is therefore inert by design — the route has to take its preview branch before any editing attribute appears. `CompositionRenderer` logs a one-line dev-mode summary of how many root nodes carry edit context, so an inert preview can be diagnosed without reading page source.

### Composition tree structure

```
BlankExperience (experience)
└── Section (OT_LandingSection display template)
    └── Row (OT_LandingRow display template)
        ├── Column (OT_LandingColumn display template)
        │   └── OT_HeroBlock (block)
        └── Column
            └── OT_CardBlock (block)
```

The Section/Row/Column adapters are registered under fixed SDK keys in `initReactComponentRegistry`:

```ts
BlankSection: BlankSectionAdapter,   // SDK's internal key for experience sections
_Row:         RowAdapter,             // SDK's fixed key for row nodes
_Column:      ColumnAdapter,          // SDK's fixed key for column nodes
```

**Section** renders a `<section>` element and delegates its children to `<OptimizelyGridSection nodes={content.nodes} />`, which handles the row/column recursion.

**Row** renders a flex container. It reads `displaySettings` for breakpoint, gap, alignment, background color, background image, overlay, animation, and reverse order.

**Column** renders a flex column. It reads `displaySettings` for span (1–12), padding, and content alignment.

Blocks that have `compositionBehaviors: ['elementEnabled', 'sectionEnabled']` in their content type definition can be placed directly inside an experience node or used as a shared block. Those without these behaviors can only be referenced from other content types (e.g. ThemeManager is queried directly, not placed in a Visual Builder composition).

---

## GraphQL — how content is fetched

Optimizely Graph is a hosted GraphQL API. All queries go through the Graph client returned by `getClient()`.

### Automatic query building via the SDK

When rendering a composition, the SDK uses the content type registry to auto-generate the GraphQL fragment for each block type. This is why all content types must be registered even if they have no custom properties — without registration the SDK generates an empty fragment and the block receives no field data.

### Direct queries (manual GraphQL)

For content that lives outside a composition — like `OT_ThemeManager` — you write the query yourself using `client.request()`:

```ts
const data = await getClient().request(THEME_QUERY, { locale: [locale] })
```

The query targets the content type by its key as the root field name. `THEME_QUERY` in `lib/optimizely.ts` is the reference example, and its shape is load-bearing:

```graphql
query GetThemeManagers($locale: [Locales]) {
  OT_ThemeManager(limit: 100, orderBy: { _metadata: { published: DESC } }) {
    items {
      _metadata { key }
      frontEndDomain
      logo { url { default } }
      footerRef { key }
      primaryNavigation {
        menuLink { text title target url { default } }
        subNavItems { menuLink { text title target url { default } } description icon }
      }
      utilityNav { menuLink { text title target url { default } } }
    }
  }
  OT_FooterBlock(limit: 20, locale: $locale) {
    items {
      _metadata { key locale }
      description { html }
      columns { heading links { label url { default } } }
      bottomLinks { label url { default } }
    }
  }
}
```

Three things about it:

- **Graph returns every published version of each item.** `limit: 100` plus `orderBy: { _metadata: { published: DESC } }` puts the newest version first, and `_fetchAllThemeManagers` then deduplicates by `_metadata.key` so each ThemeManager appears once.
- **The footer is a parallel root query, joined by key in TypeScript.** `ContentReference.item` is **not** resolvable for `_component` types in Graph — such references come back as `__typename: "Data"` with no expanded fields. So `footerRef { key }` is fetched alongside a root `OT_FooterBlock` query, and the matching footer is grafted onto `footerRef.item` in code before `Footer.tsx` reads it.
- **The `$locale` variable applies to the footer only.** ThemeManager itself is not locale-filtered (its localized field, `copyright`, resolves through the SDK context); the footer is authored per locale and must be requested for the active one.

**Shape rules for direct queries:**
- `url` fields return `{ default }` — always use `.url.default`
- `contentReference` fields to media (`_image`) return the referenced item expanded; access `.url.default` for the asset URL. References to `_component` types do **not** expand — request `{ key }` and join manually, as above.
- `array` fields of component sub-types return an array of objects with the sub-type's properties
- `link` fields return `{ text, title, target, url { default } }`

**`cms://content/{key}` is not resolved for you.** The CMS link picker stores internal page references as `cms://content/{contentKey}`, and Graph returns that URI verbatim. `lib/optimizely.ts` collects every such value across all ThemeManagers, resolves them to canonical pathnames in one batch `_Content` query, and rewrites them in place — so Header and Footer only ever see plain web paths. Any new direct query that surfaces editor-picked links needs the same treatment.

### Preview queries

For draft/unpublished content, `getClient().getPreviewContent(previewParams)` is used instead of `getContentByPath`. The SDK handles the auth token exchange internally. Always pass `{ cache: false }` for preview fetches.

### React `cache()` deduplication

Any function that calls `getClient()` and is called from multiple server components in the same request should be wrapped in React's `cache()` function. This prevents duplicate Graph round-trips when, for example, both `app/layout.tsx` and `Header.tsx` each call `getSiteSettings()`.

---

## Locales and i18n

Four locales ship: `en` (default), `es`, `fr`, `de`. They are declared in two places that must stay in sync — `i18n/routing.ts` (next-intl's `defineRouting`, the middleware's source of truth) and `SUPPORTED_LOCALES` / `DEFAULT_LOCALE` in `lib/i18n/config.ts` (what the Graph layer reads). `localePrefix: 'as-needed'` means the default locale has no URL prefix (`/about`) and every other locale is prefixed (`/fr/about`).

### The gotcha that looks like a routing bug

Content Graph indexes content at an **unprefixed** path only when the CMS instance treats that locale as its default. On an instance with several locales enabled and **none marked default**, every locale gets a prefix — English included. English content is then indexed at `/en/about`, the unprefixed lookup for `/about` returns nothing, and the page 404s.

The symptom is misleading: the header and footer still render, because they read ThemeManager directly and never touch the page path. So a whole site 404s while its chrome looks healthy, which reads as a routing or middleware fault rather than a locale one. Check the CMS's default-language setting first.

### `getLocalizedContentByPath(path, locale, baseUrl?, variationSlug?)`

All page lookups go through this function rather than `getContentByPath` directly. It calls `setRequestContext(locale)` first, then:

**Default locale — two steps:**
1. Look up `path` as-is.
2. If that returns nothing, retry at `/<locale><path>`. This is what keeps the front end working against either CMS arrangement described above.

**Non-default locale — three steps:**
1. `/<locale><path>` — the common case, where the slug is identical across locales (`/about` → `/es/about`).
2. If nothing: fetch the English version at `path` to get its `_metadata.key`, then `getItems({ key, locale })` for that key's translation. This covers pages whose **slug changes per locale** (`/ui-testing2/` in English → `/fr/polished-landing/` in French), which step 1 can never find.
3. If still nothing: return the English content as a fallback, so the page renders rather than 404s.

When several results come back, `pickByLocale` prefers an exact locale match (allowing `xx-YY` region variants either way), then the default locale, then the first item.

`variationSlug` is the FX content-experiment hook: when set, the fetch passes `{ include: 'SOME', value: [slug], includeOriginal: false }` so Graph returns only that CMS variation, or nothing — and the caller keeps the already-fetched default.

In preview, the locale does **not** come from the middleware. The CMS editor supplies it as the `loc` query param, and the route passes that to both `setRequestContext` and `PreviewParams.loc`.

---

## Assets and DAM

Every asset now comes from **DAM**. A DAM asset is referenced from the CMS exactly like CMS media — as `cms://content/{assetKey}`. The `graph://cmp/...` form is rejected. The CMS stores the reference back as `cms://content/DamImageSource/{key}`, and Graph hands the front end an `images3.cmp.optimizely.com` URL.

Two separate resolution concerns, easy to conflate:

- **Asset references** on `contentReference` fields resolve through Graph normally — `field.url.default` gives the CDN URL.
- **Link references** (`cms://content/{key}` values stored by the link picker) are **not** auto-resolved by Graph. They are batch-resolved in `lib/optimizely.ts` — see the note at the end of the GraphQL section.

### Image delivery (`lib/imageLoader.ts`)

`next.config` sets `images.loader = 'custom'` with `loaderFile: './lib/imageLoader.ts'`, so image delivery bypasses Vercel's Image Optimization API entirely. That API is spend-capped per project and returns HTTP 402 (`OPTIMIZED_IMAGE_REQUEST_PAYMENT_REQUIRED`) once the cap is hit, at which point images silently stop rendering. The `remotePatterns` list in `next.config` is retained as documentation of the expected source hosts; a custom loader does not consult it.

Per-host behaviour:

| Host | Resizing |
|---|---|
| `*.cmp.optimizely.com` (DAM CDN) | **Yes — via a `width` query param, and nothing else.** `w`, `d`, `fm`, `format`, `quality`, `auto`, `tr`, `resize`, `size`, and `preset` are all silently ignored and return the original, which is exactly why the capability went unnoticed. Measured on a 6720×4480 source: no param → 3488 KB; `width=400` → 28 KB; `width=800` → 82 KB; `width=1600` → 251 KB. Transformed variants return `x-image-transformed: true` with `cache-control: max-age=86400` and are Cloudflare-cached, so each size costs one resize, not one per visitor. |
| `*.cms.optimizely.com` and other `*.optimizely.com` | **No.** The CMS ignores resize params and always returns the original, so the loader serves the canonical URL — one cacheable file instead of N identical copies in the srcset. Legacy, now that every asset comes from DAM. |
| `images.unsplash.com` | Yes, natively — `w` / `q` / `auto=format` are passed through. |
| `/...` and anything else | Returned as-is. |

Requested widths are clamped to `CMP_MAX_WIDTH = 5000`. The clamp is load-bearing, not defensive: above that the CMP service returns a hard `400 Requested size is higher than max allowed size (5000x5000)` rather than falling back to the original. Next's default `deviceSizes` stop at 3840, but an explicit `width={...}` on an `<Image>` is passed straight through and can exceed the limit.

`quality` is deliberately not forwarded to the DAM CDN — it is ignored there, and sending it would only fragment the CDN cache across identical variants.

---

## Routing

### Site routes (`app/(site)/`)

**`app/(site)/[...slug]/page.tsx`** — the catch-all CMS page route. For every URL segment, it:

1. Calls `getLocalizedContentByPath(path, locale, baseUrl)` to fetch the experience at that path
2. If a signed `preview_token` query param is present, calls `getClient().getPreviewContent(previewParams, { cache: false })` instead — retried up to 3 times with a short backoff, because Graph can lag several seconds behind a save in the editor
3. If the response has `composition.nodes`, renders `<CompositionRenderer nodes={...} />`
4. If not, branches by `__typename` to the `_page` renderers (`OT_BlogPage`, `OT_CampaignPage`, `OT_EventPage`, `OT_TopicHubPage`)
5. If in preview and the content is a standalone block (no composition, no `_page` match), redirects to `/preview`
6. Otherwise calls `notFound()`

**Preview must not be gated on `draftMode()`.** Next's draft cookie (`__prerender_bypass`) is `SameSite=Lax`, and Visual Builder renders the site in an iframe served from the CMS origin — the cookie is third-party there, so the browser withholds it and `dm.isEnabled` comes back `false` even after `/api/draft` enabled it. Gate on the cookie and the route falls through to the published path, the SDK never attaches `__context`, and VB shows a page that is correct and completely inert.

The signed `preview_token` is the actual authorization and is what drives the preview branch. `draftMode()` is kept only as an `OR`, so non-CMS draft links (`ext_preview`) keep working:

```ts
const hasPreviewToken = !!sp_str('preview_token')
const inPreview       = dm.isEnabled || hasPreviewToken
// …but the preview FETCH requires the token:
if (inPreview && hasPreviewToken) { /* getPreviewContent */ }
```

`app/(site)/page.tsx` (the home route) carries the same branch for the same reason — Visual Builder lands there whenever the experience resolves to `/` or `/en/`.

### Draft entry points (`app/api/draft/`)

There are two draft API routes:

**`/api/draft/route.ts`** — simple draft mode enabler. Sets the Next.js draft mode cookie and redirects to the target path with all preview params as query string parameters. Used when the CMS has the preview URL set to this endpoint.

**`/api/draft/[...slug]/route.ts`** — smarter draft enabler. Fetches the content item by key + version to determine its type, then routes to the appropriate preview location:
- `_Experience` → redirects to the experience's CMS URL path
- `_Component` → redirects to `/preview` (shared block preview)
- `_Page` → redirects to the page's URL

**`/api/draft/disable/route.ts`** — disables Next.js draft mode.

---

## Preview system

The Optimizely Visual Builder opens a preview iframe pointing at the Next.js app. The preview system has several moving parts.

### `communicationinjector.js`

A script served from the CMS instance itself (`${OPTIMIZELY_CMS_URL}/util/javascript/communicationinjector.js`). It must be loaded on every preview page. It sets up `window.epi`, the message bridge between the CMS editor and the front-end iframe.

### `<NextPreviewComponent />`

Imported from `@optimizely/cms-sdk/react/nextjs`. The Next.js-optimised preview client that integrates with the App Router: when an editor saves a change that resolves to the same URL, it calls `router.refresh()` (a soft RSC re-render) instead of a full navigation, giving seamless in-place updates. For same-origin navigations (e.g. switching to a different experience page) it calls `router.push()`. Use this in all preview and draft-mode routes; the generic `PreviewComponent` from `@optimizely/cms-sdk/react/client` is the fallback for non-Next.js frameworks.

### On-page editing (`components/draft/OnPageEdit.tsx`)

A client component that subscribes to the `contentSaved` event on `window.epi` and updates `innerHTML` of elements marked with `data-epi-property-name` in place — giving instant feedback for simple text edits without a full page reload.

### `withAppContext`

A higher-order component from `@optimizely/cms-sdk/react/server`. Wrap any page that renders CMS compositions with it. It provides the app context that composition rendering needs to resolve component registry lookups and inject preview metadata.

```tsx
export default withAppContext(CmsPage)
```

### `/preview` page (`app/preview/page.tsx`)

A dedicated page for rendering standalone blocks (those not placed inside an experience). It calls `getPreviewContent()`, then:

- If the result has `composition.nodes` → it is an experience; renders full layout + `<CompositionRenderer>`
- Otherwise → it is a standalone block; renders `<OptimizelyComponent content={standaloneContent} />`

For standalone blocks, `__composition: { key: contentKey }` is synthesized onto the content object so the adapter's `pa(content.__composition)` call generates the correct `data-epi-block-id` attribute for the CMS overlay.

### Draft route group (`app/(draft)/`)

A separate route group layout for draft rendering. Loads `communicationinjector.js` and mounts `<OnPageEditBridge />` (the client-side `OnPageEdit` component). Forced to `dynamic = 'force-dynamic'` and `revalidate = 0` so draft content is never cached.

### Default application requirement

If the CMS instance has more than one application defined, a default application must be set (Settings → Applications in the CMS admin). Without a default, the Visual Builder cannot determine which front-end URL to use for shared block previews and shows "Preview is not configured."

---

## Preview vs production — rendering differences

The CMS preview renders through the same Next.js app as production, but there are structural and data differences that affect how components look. This causes persistent visual discrepancies between the CMS editor and the live site. Understanding these differences prevents incorrect "bug" diagnoses and guides better component design.

### How each preview context works

| Context | Entry route | Data source | Layout |
|---|---|---|---|
| **Visual Builder (experience)** | slug or home route, `preview_token` present | `getPreviewContent(previewParams)` | Full site layout (Header + Footer) |
| **Page preview (`_page` type)** | slug route, `preview_token` present | `getPreviewContent(previewParams)` | Full site layout (Header + Footer) |
| **Standalone block preview** | `/preview?key=...` | `getPreviewContent(previewParams)` | No site layout — `OptimizelyComponent` renders directly against canvas background |

### Data differences between preview and public

In preview, content comes from `getPreviewContent()` (SDK direct return). When public, `_page` types run a targeted GraphQL query (`getBlogPage`, etc.) that explicitly requests all needed fields.

**Key difference**: `getPreviewContent()` may return content references in a different shape than a Content Graph query. Fields that rely on Content Graph expansion (like `featuredImage.url.default`) may be present as a raw content reference object with a `key` but no expanded URL. Always test that any `?.url?.default` access has a graceful fallback — do not assume it is equivalent to the published Graph result.

**Example** — atmospheric blog header: `imageUrl = featuredImage?.url?.default` may be `undefined` in preview even when an image is assigned. The component must show a branded fallback background rather than relying on the image to fill the space.

### Visual differences to expect and design around

**1. Standalone block previews look sparse**

`OptimizelyComponent` renders the block with no surrounding layout. The block appears in the top-left of a dark canvas page. This is correct behaviour — the block adapter (`cms/components/`) should wrap its output in a preview shell that provides minimum padding and a full-height background so editors can see the block clearly without surrounding page context.

Pattern — add to every adapter that will be previewed standalone:
```tsx
return (
  <div className="min-h-screen bg-canvas flex items-start justify-start p-xl">
    <div {...pa(content.__composition)} className="...your-block-styles...">
      {/* block content */}
    </div>
  </div>
)
```

**2. `vh`-based sizing behaves differently in the preview iframe**

The CMS preview iframe is typically narrower and shorter than a real browser viewport. A header with `min-h-[68vh]` that fills two-thirds of the screen on Vercel may fill the *entire* visible area of the CMS preview iframe, hiding the content that `justify-end` pushes to the bottom. Mitigate with responsive min-heights:

```tsx
// Good — smaller on constrained viewports (including CMS iframe)
className="min-h-[55vh] lg:min-h-[68vh]"

// Bad — always 68 % of whatever viewport the iframe has
className="min-h-[68vh]"
```

**3. Featured images may not load in preview**

Image URLs from `getPreviewContent()` resolve to CMS-hosted assets. In some contexts the image may fail to load (indexing delay, transient auth). Components with full-bleed background images must declare a hardcoded fallback background colour so the editor sees a branded surface, not a black void.

```tsx
// Hardcode the fallback — do not rely solely on CSS variables for critical backgrounds.
// bg-brand via a Tailwind class resolves through CSS custom properties and
// still works; but an inline style with an explicit oklch value guarantees
// something visible even before the theme CSS has applied.
<header style={{ backgroundColor: 'oklch(38% 0.16 195)' }}>
  {imageUrl && <img src={imageUrl} className="absolute inset-0 w-full h-full object-cover" />}
</header>
```

**4. CSS custom properties resolve identically in preview and production**

The root layout (`app/layout.tsx`) runs for every route including `/preview` and the slug route in draft mode. `data-theme` is resolved **server-side** there — the `site-theme-user` cookie, falling back to the ThemeManager `defaultMode`, falling back to `dark` — and rendered onto `<html>` in the SSR output; there is no inline theme script. `styles/tokens.css` defines all `--ot-*` variables in `:root`. CSS custom properties are available in every preview context — do not duplicate or hardcode design token values in adapters as a "preview fix." The exception is critical background colours where a hardcoded fallback guarantees visibility before the first CSS paint (see point 3 above).

**5. `pa()` attributes are no-ops in production**

`getPreviewUtils(content)` returns a `pa` function that emits `data-epi-property-name` or `data-epi-block-id` attributes only when preview mode is active. In production it returns `{}`. Never gate rendering logic on the presence of `pa` attributes — they are metadata overlays, not conditional flags.

### Checklist for every new component

Before shipping a block or page adapter:

- [ ] Does the component have a visible fallback if `featuredImage?.url?.default` is null?
- [ ] If the component uses `min-h-[Xvh]`, is it responsive enough that the CMS iframe won't hide the content?
- [ ] Does the standalone block adapter wrap in a `min-h-screen bg-canvas p-xl` preview shell?
- [ ] Are all design token references via `var(--ot-*)` or Tailwind utilities, not hardcoded colour values (except critical fallback backgrounds)?
- [ ] Does `pa()` appear on every directly-editable field and on `content.__composition`?

---

## CLI — syncing content types to the CMS

The `optimizely.config.mjs` file tells the CLI what to push:

```js
export default {
  components: [
    'cms/content-types/*.ts',
    'cms/display-templates/*.ts',
    // Exclude built-in OptiForms types — owned by the Forms product,
    // cannot be modified via the CLI. The display template is excluded too:
    // pushing it errors with "Unable to find content type
    // 'OptiFormsContainerData'" because the backing type is never pushed.
    '!cms/content-types/OptiForms*.ts',
    '!cms/display-templates/OptiForms*.ts',
  ],
  propertyGroups: [
    { key: 'OT_Content',      displayName: 'Content',           sortOrder: 100 },
    { key: 'OT_Style',        displayName: 'Style',             sortOrder: 150 },
    { key: 'OT_Theme',        displayName: 'Theme',             sortOrder: 200 },
    { key: 'OT_SEO',          displayName: 'Search & Discovery', sortOrder: 300 },
    { key: 'OT_Integrations', displayName: 'Integrations',      sortOrder: 400 },
  ],
}
```

Run **`yarn cms:push`** after any change to a content type or display template. That script (`scripts/cms-push.mjs`) wraps `node_modules/@optimizely/cms-cli/bin/run.js config push`: it resolves the env file (`.env.<branch>`, else `.env.local`; override with `CMS_ENV_FILE`) and passes it via `--env-file`, because the CLI does not read `.env` files on its own. The CLI then reads the TypeScript files, serializes the schema, and pushes it. The front end can start using new fields immediately after a push.

`yarn cms:push:dry` previews the manifest without writing. `yarn cms:push:bootstrap` is for a **fresh** instance only: `mayContainTypes` creates a reference cycle that the importer cannot order when it has to create every type at once, and it rejects the manifest with "circular dependency through …", cascading into misleading "Unable to find a content type 'OT_…'" errors as the import rolls back. The bootstrap flag pushes once with every `mayContainTypes` stripped, then pushes the real manifest as an update. It is opt-in because it forces `ignore-data-loss-warnings`, which is safe on an empty instance and not on a populated one.

**Never rename a content type key.** Renaming breaks existing content in the CMS. Add new types or new fields; avoid removing or renaming existing ones unless the content has been migrated.

---

## Adding a new CMS page type — checklist

`_page` types are traditional CMS pages with URLs. Unlike `_experience` types (which render a Visual Builder composition), they are fetched and rendered by a dedicated React component in the Next.js route handler.

1. **Content type** — create `cms/content-types/OT_MyPage.ts` using `contentType({ key, baseType: '_page', properties })`. No `compositionBehaviors` (pages are not placed inside compositions).

2. **Register** — in `cms/registry.ts`, add the content type to `initContentTypeRegistry`. No display template is needed. A resolver entry is optional: public rendering goes through the route handler, so a `_page` type works without one. Several types here (`OT_BlogPage`, `OT_EventPage`, `OT_FolderPage`, `OT_TopicHubPage`) do register an adapter, purely so the preview paths (`/preview`, the CMS editor's preview pane) have something to render.

3. **Push to CMS** — run `yarn cms:push`.

4. **Data fetching** — add query functions to `lib/blog.ts` (or a new `lib/my-page.ts`). Use `getClient().request(QUERY, vars)` for direct GraphQL queries. For related content (e.g. latest posts), use `cache()` from React to deduplicate cross-component fetches.

5. **React component** — create `components/pages/MyPage.tsx`. Receives all content as typed props. No CMS SDK imports.

6. **Route handler** — in `app/(site)/[...slug]/page.tsx`, add a branch inside the `!exp?.composition?.nodes` block that checks `exp?.__typename === 'OT_MyPage'`. For public requests make a targeted direct query to fetch all fields (the initial `getContentByPath` call may not return page-specific fields). For draft/preview mode, `exp` from `getPreviewContent` already contains all fields and can be used directly.

7. **Showcase** — add a `<YourPageShowcase />` component to `app/(site)/showcase/blocks/[block]/page.tsx` and a `{ label: 'Your Page', slug: 'your-page' }` entry to `app/(site)/showcase/config.ts`.

### How `_page` routing differs from `_experience`

| | `_experience` | `_page` |
|---|---|---|
| Renders via | `<CompositionRenderer>` (SDK composition tree) | Dedicated React component |
| Display template | Yes — controls Visual Builder settings | Not needed |
| CMS adapter | One per block type inside the experience | Not needed |
| Route detection | `exp?.composition?.nodes` exists | `exp?.__typename === 'OT_MyPage'` |
| Preview mode | Uses `exp` from `getPreviewContent` directly | Same |
| Field data source | SDK auto-generates fragment from registry | Direct GraphQL query in `lib/` |

### Existing `_page` types

| Type key | Component | Data fetching |
|---|---|---|
| `OT_BlogPage` | `components/pages/BlogPage.tsx` | `lib/blog.ts` — `getBlogPage(key, locale)`, `getLatestBlogPosts(excludeKey, locale, baseUrl)` |
| `OT_CampaignPage` | `components/pages/CampaignPage.tsx` | `lib/campaign.ts` — `getCampaignPage(key)`, `getCampaignPageMeta(key)`, `mapCampaignPageRaw(exp)` for the preview path |
| `OT_EventPage` | `components/pages/EventPage.tsx` | `lib/events.ts` — `getEventPage(key, locale)` |
| `OT_TopicHubPage` | `components/pages/TopicHubPage.tsx` | `lib/topicHub.ts` — `getTopicHubPage(key, locale)` |
| `OT_FolderPage` | `cms/components/OT_FolderPage.tsx` (adapter, editor preview only) | none — the type exists to group children in the CMS tree and 404s on the public site |

---

## OptiForm elements — separate service, not the CMS SDK

The `OptiFormsChoiceElement`, `OptiFormsTextboxElement`, `OptiFormsNumberElement`, and related types that appear in `cms/registry.ts` and `cms/content-types/` are **Optimizely Forms** — a hosted form service that is separate from the Optimizely SaaS CMS SDK. They are registered in the content type registry purely so the SDK can include them in GraphQL composition fragments for forms editors place in Visual Builder, but they are **not authored through the four-layer block pattern**, and they are deliberately never pushed (`optimizely.config.mjs` excludes the globs).

### Registration is gated on `NEXT_PUBLIC_OPTIFORMS_ENABLED`

Registration is **not** unconditional. All 12 OptiForms content types, the `OptiFormsContainerDefault` display template, and all 10 OptiForms adapters are behind:

```ts
const OPTIFORMS_ENABLED = process.env.NEXT_PUBLIC_OPTIFORMS_ENABLED === 'true'
```

The reason: registering a type makes the SDK emit a fragment for it in every composition query. That only works on an instance where Forms is actually enabled, because Graph exposes the `OptiForms*` types there. On an instance **without** Forms the types are registered but absent from the Graph schema, and every CMS page query dies with:

```
HTTP 400: 9 errors in the GraphQL query
```

The nine are Choice, Number, Range, Reset, Selection, Submit, Textarea, Textbox, and Url — the `elementEnabled` types that reach composition fragments. Set the flag to `true` only on instances that have Forms; leave it unset everywhere else.

Do not:
- Create display templates for OptiForm types
- Build CMS adapters for OptiForm types following the `OT_` pattern
- Attempt to style OptiForm fields using `cms/styling/` helpers
- Try to add OptiForm types to `compositionBehaviors`

If editors report form preview issues or the forms service does not render in the preview iframe, the root cause is the Forms service configuration (webhook endpoints, form IDs, or site permissions) — not the Next.js application code.

---

## Adding a new CMS block — checklist

Follow all steps in order; omitting any step causes silent failures.

1. **Content type** — create `cms/content-types/OT_MyBlock.ts` using `contentType({ key, baseType, compositionBehaviors, properties })`. Add `compositionBehaviors: ['elementEnabled', 'sectionEnabled']` if the block should be placeable in experiences.

2. **Display template** — create `cms/display-templates/OT_MyDefault.ts` using `displayTemplate({ key, contentType: 'OT_MyBlock', isDefault: true, settings })`. Define every editor-controllable visual option as a `select` setting with named choices.

3. **Register** — in `cms/registry.ts`, add the content type to `initContentTypeRegistry`, the display template to `initDisplayTemplateRegistry`, and the adapter to `initReactComponentRegistry`.

4. **Push to CMS** — run `yarn cms:push`. Verify the count in the output matches expectations.

5. **Styling helper** — create `cms/styling/OT_MyBlock.styling.ts`. Export a function that translates `Record<string, string | boolean>` → typed `MyStyleOptions`, applying defaults for each setting.

6. **Adapter** — create `cms/components/OT_MyBlock.tsx`. Import `getPreviewUtils`, the styling helper, and the React component. Follow the standard adapter pattern: outer `<div {...pa(content.__composition)}>`, spread `pa` on each editable element.

7. **React component** — create `components/blocks/MyBlock.tsx`. Pure React component with typed props. Use `cva` for variant logic driven by `styleOptions`. Spread `pa('fieldName')` on each element that holds an editable property. The component must not import anything from `@optimizely/cms-sdk`.

8. **Showcase** — add a `<YourBlockShowcase />` component to `app/(site)/showcase/blocks/[block]/page.tsx`, a case in the switch statement, and a `{ label: 'Your Block', slug: 'your-block' }` entry to `app/(site)/showcase/config.ts`. Both files must be updated or the block won't be reachable from the nav.

---

## File map

```
cms/
  content-types/     TypeScript schema definitions (pushed to CMS via CLI)
  display-templates/ Visual setting schemas (pushed to CMS via CLI)
  components/        CMS adapter components (bridge CMS data → React props)
  compositions/      Section / Row / Column structural adapters
  styling/           DisplaySettings → StyleOptions translators

components/
  blocks/            Pure React presentational components
  layout/            Header, Footer, Nav (server components fed by ThemeManager)
  draft/             OnPageEdit (client component for in-place edits)
  preview/           BlockRenderer (wraps OptimizelyComponent for standalone blocks)
  providers/         ThemeProvider, MotionObserver

app/
  layout.tsx         Root: SDK init, ThemeManager fetch, font vars, theme CSS injection
  (site)/
    [...slug]/       Catch-all CMS page renderer
    showcase/        Static design system reference (not CMS-driven)
  (draft)/
    layout.tsx       communicationinjector.js + OnPageEditBridge
    draft/[v]/block/ Draft block preview (deprecated path — use /preview)
  api/draft/         Draft mode API routes
  preview/           Standalone block + experience preview page

lib/
  optimizely.ts      SDK init, getClient, getSiteSettings, getLocalizedContentByPath,
                     buildThemeCSS, cms:// link resolution, withGraphResilience
  CompositionRenderer.tsx  Drop-in replacement for the SDK's OptimizelyComposition
  with-tokens.ts     createTokenAwareResolver — wraps every registry adapter
  imageLoader.ts     Custom next/image loader (DAM CDN width resizing)
  i18n/config.ts     SUPPORTED_LOCALES, DEFAULT_LOCALE, prefix helpers

i18n/
  routing.ts         next-intl defineRouting — middleware source of truth

cms/
  registry.ts        Registers all types, templates, and components with the SDK

optimizely.config.mjs  CLI push config (paths + property groups)
```

---

## Lessons learned — known gotchas

Consolidated from real build failures and runtime bugs. Read this before starting any CMS work.

### Build fails with "Unknown type OT_YourBlock" on Vercel

**Cause:** Registering a content type in `cms/registry.ts` immediately includes it in every GraphQL composition fragment the SDK auto-generates. If the type hasn't been pushed to the CMS Graph yet, the Next.js static page generation query returns HTTP 400.

**Fix:** Run `yarn cms:push` before merging/deploying any new content type. The dev server (`yarn dev`) is not affected because it does not run static page generation.

### Push through `yarn cms:push`, not the CLI directly

The CLI does not load `.env` files, so invoking it by hand fails on missing credentials. Use `yarn cms:push`, which resolves the env file and passes it in. If you do call the CLI directly, the subcommand is `config push` — a bare `push` does nothing.

### `richText` fields return an object, not a string

A `type: 'richText'` property returns `{ html, json }` from GraphQL. Always use the `.json` field and render with the SDK's `<RichText>` component — never use `.html` with `dangerouslySetInnerHTML`:

```tsx
// In the adapter — pass json to the UI component:
body={content.body?.json ?? undefined}

// In the React component — render with the SDK component:
import { RichText } from '@optimizely/cms-sdk/react/richText'

{body && (
  <div className="your-prose-styles" {...pa('body')}>
    <RichText content={body} />
  </div>
)}
```

The wrapping `<div>` provides the styling context (Tailwind classes, `data-rich-text` attributes). `<RichText>` renders Slate JSON nodes inside it.

The UI component's prop type for a rich text field should be:
```ts
body?: Parameters<typeof RichText>[0]['content'] | null
```

### Server adapters cannot be imported in client components

CMS adapter components (`cms/components/OT_*.tsx`) are server components — they import from `@optimizely/cms-sdk/react/server`. Importing them inside a `'use client'` module will either fail silently or produce unexpected output.

The showcase pages (`app/(site)/showcase/blocks/[block]/page.tsx`) are server components — they must **not** have `'use client'` at the top. The adapter imports work correctly there. If a showcase page ever becomes a client component, replace adapter imports with direct imports of the underlying `components/blocks/` component and map props manually.

### Showcase nav requires two file updates

Adding a new block showcase requires updating **both**:
1. `app/(site)/showcase/blocks/[block]/page.tsx` — the showcase component and switch case
2. `app/(site)/showcase/config.ts` — the nav chip entry

Missing the config update means the route exists but is unreachable from the nav. There is no redirect from the listing page; it redirects to `hero` by default.

### `prefers-reduced-motion` gates CSS animations

Custom CSS animation classes defined inside `@media (prefers-reduced-motion: no-preference)` blocks will not animate on machines where Reduce Motion is enabled (macOS: System Settings → Accessibility → Motion → Reduce Motion). This is correct WCAG behaviour, not a bug. For animations that need to be reliable across environments, apply the `animation` property via inline React style, referencing the `@keyframes` name directly. The keyframe definition can remain in `globals.css` without the media query wrapper.

### Empty `allowedTypes` means EVERY registered type, not "any type"

**Symptom:** setting `allowedTypes: []` on a `contentReference` — tempting, because it is the only shape the CMS API accepts a DAM asset in — makes every page query fail with `HTTP 400: 9 errors in the GraphQL query`.

**Cause:** the SDK's `resolveAllowedTypes` does `const baseline = allowed?.length ? allowed : cached`. An empty list is falsy, so it falls back to every cached content type and the generated query spreads a fragment for all ~70 of them.

**Fix:** keep image references narrowed to `['_image']`. DAM assets reach the site through `OT_ResourceLibraryBlock`, which queries `cmp_Asset` directly via Graph (`lib/resourceLibrary.ts`).

### Every row of the Visual Builder Outline reads "Blank Section"

**Symptom:** the Outline is a wall of identical "Blank Section" rows and editors cannot tell the sections apart.

**Cause:** the section node has no `displayName`.

**Fix:** set `displayName` on every section node when building compositions.

### `sectionEnabled` vs `elementEnabled` placement

**Symptom:** two different rejections for the same block. As a section node component: *"The component type is not based on section base type."* Inside a column: *"Only element enabled components are allowed within an section."*

**Cause:** only `elementEnabled` blocks may sit in a column. A `sectionEnabled`-only type (e.g. `OT_FeatureGridBlock`, whose `compositionBehaviors` is `['sectionEnabled']`) is rejected in **both** positions.

**Fix:** declare both behaviours for a block that needs to work in either place. Related constraint, from `cms/content-types/OT_FooterBlock.ts`: the CMS disallows array/component properties on `elementEnabled` blocks — which is why `OT_FooterBlock` declares no `compositionBehaviors` at all and is assigned through `ThemeManager.footerRef` instead.

### REST write gotchas (Content Management API)

Graph is read-only, so anything that creates or edits content — the demo-site builds, `lib/cmsApi.ts`, `app/api/cmp-publish/` — goes through the Content Management REST API. Four things cost real time there:

- **`POST /v1/content/{key}/versions` builds the new version from the payload alone.** Any property you omit is **blanked**, not preserved. Always re-post the full property set.
- **`displayName` is required** on that call.
- **The response body is empty.** The new version number arrives in the `Location` header (`.../content/{key}/versions/{version}`); a create returns `.../content/{key}` with no version, so the draft version has to be looked up separately.
- **The `/versions` list is not sorted.** `items[-1]` is not the latest — filter on `status`.

### API authorization is two layers

**Symptom:** `GET /v1/contenttypes` returns 200 while `POST /v1/content` returns 403 `Required access is 'create'`; `GET /v1/content/versions` returns `totalCount: 5` with an empty `items` array.

**Cause:** the `api:admin` scope only opens the API. Read/write on a content item is granted separately, **per item**, against the API key.

**Fix:** grant it in the CMS under Settings → Set Access Rights for the relevant content.

### Graph indexing lags behind a publish

Content Graph is a few minutes behind a CMS publish, so Visual Builder 404s a freshly created page until indexing catches up. Both the home route and the catch-all retry `getPreviewContent` three times with a short backoff to absorb the shorter (5–30 s) lag after an editor save; a genuine cold-index delay just has to be waited out.

### Graph requests hang instead of failing

**Symptom:** a page appears to load forever; the server log eventually shows `UND_ERR_HEADERS_TIMEOUT` from undici.

**Cause:** a stalled `fetch` (dropped VPN, network blip) has no useful default timeout.

**Fix:** already handled — `withGraphResilience` in `lib/optimizely.ts` races every Graph call against a 12 s timeout and retries once. Route new Graph calls in that file through it.

### A display-template setting change is the cheapest visual variant

Display-template settings live in the composition, not on the content type. Adding one — a new `select` choice, a new setting — needs **no** `config push` and **no** Graph re-index, unlike adding a property to a content type (noted in `cms/display-templates/OT_CardDefault.ts`). When a block needs a new visual variant, reach for a display-template setting before a new content-type property.

### `mayContainTypes` must be set on page/experience/folder types

Without `mayContainTypes`, the CMS defaults to "None" for allowed child content types, and editors cannot create child pages or nest content in the tree. Every `_page`, `_experience`, and `_folder` type that should contain children needs this field. Use `'_self'` for self-referential nesting and string keys for cross-references to avoid circular imports.

### OptiForm elements are third-party — and gated

`OptiFormsChoiceElement` and related types in the registry are Optimizely Forms — a separate service. They exist in the registry only for GraphQL fragment compatibility, and only when `NEXT_PUBLIC_OPTIFORMS_ENABLED=true`. On an instance without Forms, registering them makes every page query fail with `HTTP 400: 9 errors in the GraphQL query`. Preview and rendering issues with forms are Forms service issues, not Next.js issues.

### Graph rejects `limit` over 100 — it does not clamp

`Invalid 'limit' (value: 200, expected: [0-100])`, and the whole document fails. `app/sitemap.ts` asked for 200 and served a valid, **empty** `<urlset>` for weeks, because a bare `catch { return [] }` turned an API error into a silent empty file that `robots.txt` kept advertising to crawlers. Cap at 100 per type and page with `skip` beyond that. The wider lesson is the `catch`, not the limit: swallowing an error on a route nobody looks at means nobody looks at it.

### DAM references need the `DamImageSource` segment

Ordinary CMS media is `cms://content/<key>`. A **DAM asset is not**:

```
cms://content/DamImageSource/2f4c455aa50b11f1916b4a7836a56b60
```

The trailing id is `cmp_Asset._itemMetadata.key` from Graph. Written without the segment the CMS accepts the value and the block renders with no image at all — no error, nothing in a log. Read the published home page's composition if you need to confirm the shape for a property; the CMS stores what it means, and it is faster than guessing.

### The CMS drops empty strings from a string array

Post `["1500 kr", "500 kr", "No", "Yes", "No", ""]` to an `array` of `string` and six values come back as five. For `OT_CompareTable`, whose grid is rebuilt from `columnLabels.length`, that shifts every value after the gap into the wrong column — silently, and the table still looks plausible. Pad missing cells with a visible placeholder (an em dash) rather than `""`.

### An array property's `items` type is not always what you assume

`OT_CompareTable.intro` is a plain `string`; posting `{ html: … }` is rejected with *"requires an element of type 'String', but the target element has type 'Object'"*. Check the content type before assuming a text field is rich text — several blocks mix both.

### The CMS accepts display-setting values the template does not declare

Posting `gridWidth: "article"` returned 201 at a point when `OT_LandingSection` declared only full/default/wide/narrow. (It declares `article` now — that push went through — so this is the account of how the width was introduced, not a claim about the current template.)

Useful, because a new width can be rendered before the template is pushed. Two conditions though: the front end falls back to `default` for an unknown value, so the class in `cms/compositions/Section.tsx` has to exist first; and the choice only appears in the Visual Builder dropdown after `yarn cms:push`, so until then an editor opening that control sees no matching option.

### `yarn cms:push` currently fails on content types, not display templates

```
Successfully imported 37 display templates.
Errors:
  - The property 'items' is not allowed when content type has ElementEnabled.
```

The CMS *holds* `elementEnabled` types with `items` quite happily — `OT_FaqBlock` and `OT_CompareTable` are live with exactly that shape, confirmed by reading them back from `/v1/contenttypes`. So this is the importer's rule, not the stored schema's, and nothing on the instance is broken by it. Display-template pushes still work; content-type pushes are blocked until the tooling or the rule changes. cms-cli 2.2.0.

### Opal caches a tool manifest at registration

Opal reads a discovery URL once, when the registry is created, and does not re-read it. Add a tool and Opal keeps reporting the old list — correctly, for what it can see. Delete the registry and recreate it, or register a new one with a cache-busting query string. `app/api/opal/discovery/route.ts` logs every fetch, so the absence of a line distinguishes "never re-read" from "read it and something else is wrong".

### Opal serialises `list` parameters as JSON strings

A parameter declared `list` in the manifest can arrive as a **string containing** an array, not an array. `Array.isArray()` then rejects a perfectly well-formed payload with a message that sends everyone looking at the content instead of the wrapping. Parse a string before validating. Related: Opal posts arguments wrapped as `{ "parameters": { … }, "auth": { … } }` rather than at the top level, and its `ParameterType` enum is `string | integer | number | boolean | list | dictionary` — `array` is not a member, and declaring it fails registration with a 400.

### `auth_requirements` in an Opal manifest means an identity provider

The values are providers whose credentials Opal resolves for the user — `google`, `microsoft`, Opti ID. There is no `bearer` provider, and inventing one makes Opal reject the whole manifest at registration. A registry's Bearer Token is a separate mechanism that Opal simply puts in the `Authorization` header; declare nothing for it.
