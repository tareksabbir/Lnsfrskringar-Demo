# 2. Local Setup and Environment Configuration

[Contents](README.md) · [Next: CMS and DAM](03-cms-and-dam.md)

## 2.1 What you need before starting

You need repository access, compatible Node.js/Yarn versions, access to the correct CMS instance, a Graph delivery key, and the site's identity. Writing schemas or content requires a separate CMS API client and item permissions. You do not need every CMP, Opal, FX, or BigQuery credential just to read frontend content.

If dependencies are already installed, avoid upgrading packages unnecessarily. Check `node --version`, `yarn --version`, and the repository lockfile. The CLI wrapper uses Node's `--env-file` option; local and deployment runtimes must support it.

## 2.2 First local run

1. Open the project directory in a terminal.
2. Read [`.env.example`](../../.env.example). Do not overwrite an existing `.env.local`; if it is missing, create it using the template as a reference.
3. Set the minimum Graph key and site identity values. Keep actual secrets out of this learning material.
4. Install dependencies and start the server:

```bash
yarn install
yarn dev
```

5. Open `http://localhost:3000`. If the homepage fails, use the [troubleshooting guide](06-change-playbook.md).
6. Visit `/showcase` to explore blocks. The root layout can fetch CMS settings, so do not assume this is a fully offline, CMS-independent test.

Minimum local example:

```dotenv
OPTIMIZELY_GRAPH_SINGLE_KEY=<delivery-key>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_DOMAIN=<this-sites-cms-domain>
CMS_GRAPH_SITE_ORIGINS=<exact-indexed-origin-1>,<exact-indexed-origin-2>
OPTIMIZELY_CMS_URL=https://<your-instance>.cms.optimizely.com
```

Values in angle brackets are placeholders. The [routing document](../cms-routing.md) records the domains/origins from the earlier Stockholm audit. Do not copy those values blindly into another tenant.

## 2.3 Three different URL settings

| Setting | Purpose | Local example |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | Origin for public/canonical links | `http://localhost:3000` |
| `NEXT_PUBLIC_SITE_DOMAIN` | Identifies which CMS site's theme/content to use | Stockholm's CMS-mapped domain |
| `CMS_GRAPH_SITE_ORIGINS` | Exact origin list used to filter Graph `url.base` | Host(s) used in CMS indexing |

A browser running on localhost does not mean Graph's `url.base` is localhost. An explicit Graph origin list replaces the domain-derived default. Adding another site's origin defeats the intended isolation.

## 2.4 Configuration reference

| Variable/setting | Where it comes from | Purpose |
|---|---|---|
| `OPTIMIZELY_GRAPH_SINGLE_KEY` | CMS/Graph API Keys | Public content delivery |
| `OPTIMIZELY_CMS_URL` | CMS instance URL | Preview communication script |
| `OPTIMIZELY_CMS_CLIENT_ID`, `OPTIMIZELY_CMS_CLIENT_SECRET` | CMS API client | Schema push and content REST writes |
| `OPTIMIZELY_CMS_API_URL` | Optional custom gateway | Defaults to `https://api.cms.optimizely.com` |
| `CMS_ENV_FILE` | Local choice | Selects the env file for `cms:push` |
| `CMP_CLIENT_ID`, `CMP_CLIENT_SECRET` | CMP API application | OAuth, asset resolution, preview callbacks, work requests |
| `CMP_CALLBACK_SECRET` | Same value in CMP webhooks and deployment | Verifies incoming CMP POST requests |
| `CMS_BLOG_CONTAINER_KEY` | Composition-blog folder key in your CMS site | Opal writer and `/blog` index |
| `CMP_BLOG_CONTAINER_KEY` | Target CMS container for imported CMP blogs | `OT_BlogPage` creation |
| `OPAL_TOOL_SECRET` | Project-managed shared secret | Bearer authentication for custom Opal tools |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | Redis/KV provider | Preview, mapping, form, and lineage persistence |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Upstash | Supported alternative to KV variables |
| `CMS_CALLBACK_SECRET` | CMS webhook authentication token and deployment | Optional authentication for asset-lineage webhook |
| `OPTI_ADMIN_USER`, `OPTI_ADMIN_PASSWORD` | Deployment administrator | Custom admin login |
| `CMP_DEFAULT_ASSIGNEE_ID` | CMP user ID | Default assignee for admin work requests |
| `NEXT_PUBLIC_OPTIFORMS_ENABLED` | Set to `true` only for a Forms-enabled instance | Runtime Forms registry gate |
| `CONTACT_EXPERIENCE_KEY` | Target contact experience key | `/contact-us` page mapping |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox account | Maps/geocoding |
| `OPTIMIZELY_REST_API_TOKEN` | Experimentation REST access | Admin experiment tooling |
| `OPTIMIZELY_FX_WEBHOOK_SECRET` | FX webhook configuration | Refresh webhook signature verification |
| `OPTIMIZELY_DEV_MODE` | Set locally to `true`, or leave unset | Verbose FX diagnostics |
| `BQ_SERVICE_ACCOUNT_JSON`, `BQ_DATASET` | Google Cloud setup | Demo event/product writes to BigQuery |
| `OPTIMIZELY_GRAPH_URL`, `REDIRECTS_TTL_MS` | Optional overrides | Redirect helper gateway/cache |

`NEXT_PUBLIC_CMS_URL` is an optional override for the draft layout; the standard setup also uses `OPTIMIZELY_CMS_URL`. The older README includes `OPTIMIZELY_GRAPH_APP_KEY`/`OPTIMIZELY_GRAPH_SECRET` for manual draft Graph queries. The main app initializer reads the delivery single key, while CMS preview uses its preview token.

This table includes settings found in code beyond those listed in `.env.example`. Search by variable name, not secret value: `rg 'process.env' app lib cms scripts`.

## 2.5 Some integration keys live in the CMS

The FX SDK key, Web Experimentation project ID, ODP tracker, GA ID, and recommendation settings live in the per-site `OT_ThemeManager`. Searching only `.env` files will not find them. See [chapter 5](05-features.md) for their wiring.

## 2.6 Two separate environment loaders

Next.js uses its own `.env*` loading rules; variables already exported into the process take priority. Browser-facing `NEXT_PUBLIC_*` values can be inlined into bundles at build time. Restart the development server after local env changes, and rebuild/redeploy after deployment env changes. Reference: the installed Next.js guide at `node_modules/next/dist/docs/01-app/02-guides/environment-variables.md`.

The [cms-push wrapper](../../scripts/cms-push.mjs) selects its file differently:

```text
If CMS_ENV_FILE is set → use that file
Otherwise → .env.<branch-name, with slashes replaced by hyphens>
Otherwise → .env.local
If none exists → error
```

The `cms:pull` package script directly uses the branch env file; do not assume it has the push wrapper's `.env.local` fallback. Credentials determine which CMS tenant receives writes.

## 2.7 What each command does

| Command | Result |
|---|---|
| `yarn dev` | Starts the local development server |
| `yarn build` | Produces a production build |
| `yarn start` | Runs an existing production build |
| `yarn lint` | Runs ESLint checks |
| `yarn lint:tokens` | Scans for hard-coded colors |
| `node --test tests/routing.test.cjs` | Runs routing regression tests |
| `npx tsc --noEmit --incremental false` | Checks TypeScript; use the installed dependency |
| `yarn preview:coverage` | Runs the project preview-coverage script |
| `yarn cms:push:dry` | Dry-runs the schema manifest without publishing the remote schema |
| `yarn cms:push` | Writes CMS schemas/templates |
| `yarn cms:pull` | Pulls CMS configuration locally; inspect the resulting diff |
| `yarn cms:push:bootstrap` | Opt-in circular-dependency recovery for a fresh instance |

Schema commands are not required simply to view a site whose tenant already has the types. Bootstrap is not a routine update command for a populated tenant. Read the wrapper's forced data-loss-warning behavior before using it.

**Checkpoint:** The homepage works, but Opal draft creation returns 503. The Graph delivery key works; now check the Opal secret, CMS REST credentials, and container configuration separately.
