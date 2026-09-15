# CMS hierarchy and published Graph routing

The CMS tree is defined by content keys and containers, not by this repository's
folders. Public content resolves relative to the CMS application's start page
and configured hostnames.

- `lib/ancestors.ts` excludes both built-in `_Folder` and custom `OT_FolderPage`
  ancestors. A successfully resolved short/empty trail is retained so the SEO
  renderer does not recreate folder links from URL segments.
- `app/sitemap.ts` pages through all six routable content types in batches of
  100. It excludes `noIndex` content and content belonging to another application.
- `lib/blogIndex.ts` identifies composition articles by the configured blog
  container's key in `_metadata.path`/`container`, including nested folders.
  Renaming the folder or an article's URL does not change membership. The
  Opal writer and listing both require explicit `CMS_BLOG_CONTAINER_KEY`;
  missing configuration returns an error instead of choosing a default folder.
- Published path lookups never retry without a site filter. Preview requests
  continue to use their CMS key, version, locale and preview token.

## Deployment configuration

`NEXT_PUBLIC_SITE_URL` is the public origin used for generated links.
`NEXT_PUBLIC_SITE_DOMAIN` identifies the CMS site when that differs from the
local/preview origin. The application accepts HTTP and HTTPS variants of that
same authority, preserving its port.

If Graph's indexed `url.base` uses another primary hostname, or separate
hostnames per locale, set `CMS_GRAPH_SITE_ORIGINS` to a comma-separated list of
those exact origins. Only include authorities for this application. This list
replaces the domain-derived defaults. Missing/mismatched site configuration
produces no matching content rather than another application's pages.

When changing CMS hostnames, run the CMS Optimizely Graph Full Synchronization
job so indexed URLs reflect the configuration. This code does not modify CMS
applications, publish content or run synchronization jobs.

## References

- [Content organization](https://docs.developers.optimizely.com/content-management-system/v1.0.0-CMS-SaaS/docs/content-saas)
- [ContentUrl and URL resolution](https://docs.developers.optimizely.com/content-management-system/v1.0.0-CMS-SaaS/docs/property-schemas-saas)
- [Application hostnames](https://docs.developers.optimizely.com/content-management-system/v1.0.0-CMS-SaaS/docs/applications)

## Verification

Run `node --test tests/routing.test.cjs` and
`npx tsc --noEmit --incremental false`.
The regression checks use isolated Graph responses, not the live CMS schema.

## Verified Stockholm development configuration (September 2026)

The CMS application `LFStockholm` currently maps English to
`https://lnsfrskringar-demo.vercel.app` and its general host to
`http://localhost:3000`. The Swedish homepage is indexed under that general
host. Local `.env.local` now identifies Stockholm explicitly and allows those
two Graph origins. Skåne's production host and localhost:3001 remain excluded.

The frontend supports `sv` and rewrites `/sv/...` to the application route while
retaining Swedish locale context. Static UI messages currently use the existing
English fallback; this change does not translate those labels.

The CMS preview templates put context in `/api/draft/{context}`. The draft route
reads this path segment and preserves it as `ctx` on the destination URL.
No CMS hostnames were modified, so a full synchronization is not required for
these frontend changes. Production environment variables must be configured
separately when deploying; `.env.local` is not committed.

### Local values

```dotenv
NEXT_PUBLIC_SITE_URL=http://localhost:3000
NEXT_PUBLIC_SITE_DOMAIN=lnsfrskringar-demo.vercel.app
CMS_GRAPH_SITE_ORIGINS=https://lnsfrskringar-demo.vercel.app,http://localhost:3000
CMS_BLOG_CONTAINER_KEY=1330a97ad221400d8048329cda2ca918
```

Keep these development values in `.env.local`. Set the public production URL
separately in the deployment environment. The Graph-origin list represents
current CMS indexing, not where the browser happens to run. Restart the dev
server after environment changes; deployment changes need a fresh build.

### Audit results and limits

- Twelve isolated regression tests pass, covering locale/admin routing,
  preview context, cross-site filtering, sitemap pagination and blog ancestry.
- TypeScript checking and focused locale/module lint checks passed. The wider
  repository still has pre-existing lint errors; this is not a clean full lint.
- Read-only CMS API calls confirmed `LFStockholm`'s application hosts. Scoped
  live Graph queries returned seven English composition pages and one Swedish
  homepage, all under the expected origins. These counts are a snapshot.
- The blog ancestry query and the four added sitemap type queries succeeded
  against the live schema; those four types returned no items at audit time.
- No deployment, CMS mutation or browser end-to-end test was performed.

## Preview and locale safeguards

Draft fetch failures show a retry/unavailable state and retain the CMS bridge
for fresh contentSaved messages; they never substitute a published homepage or
campaign. External preview links carry temporary CMS tokens, valid for five
minutes after issuance. Copying or reloading a link does not renew its token.
The expiry notice and retry UI are project choices, not UI prescribed by the
Optimizely documentation. A fresh CMS preview URL is needed after expiry.

Language options come from this application's published page facets; Graph
failure returns no inferred language options. Language switching resolves the
current content key and asks for that key's target-locale URL. Missing
translations keep the visitor on the current page with a message.

Preview refresh follows the official contentSaved event and consumes the new
previewUrl/previewToken. It never restores an expired token or previous version
from the current URL. The shared bridge no longer patches the DOM separately.
Error/retry messages and the temporary-link expiry notice are application UI
choices; Optimizely documents token lifetime and refresh, not their UI wording.
