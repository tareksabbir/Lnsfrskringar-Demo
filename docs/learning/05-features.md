# 5. Experiments, Forms, Admin, and Other Features

[Contents](README.md) · [Next: Change playbook](06-change-playbook.md)

Every feature described here has an implementation in the repository. Whether the associated SaaS entitlement, credentials, data, and live configuration are active requires separate verification.

## 5.1 Feature Experimentation: complete wiring

```text
ThemeManager.featureExperimentationSdkKey
   + BlankExperience.FxFlagKey
   + visitor optimizely_user_id / attributes / segments
       → SDK decide(flagKey)
       → variable cms-saas-content-variation
       → exact CMS variation from Graph
       → page render
```

Sources: [FX resolver](../../lib/fx/variant-resolver.ts), [FX client](../../lib/fx/client.ts), [experience schema](../../cms/content-types/BlankExperience.ts), and [identity](../../lib/fx/identity.ts).

Setup walkthrough:

1. Obtain the SDK key for the correct FX project environment and put it in the CMS ThemeManager's `featureExperimentationSdkKey` field.
2. Create or select an FX flag, such as `learning_hero`.
3. Add a string variable named exactly `cms-saas-content-variation`, with default value `Original`.
4. Create a CMS experience variation named, for example, `LearningB`. Give it a visibly different headline and publish it.
5. Set the FX variation's variable value to exactly `LearningB`. Names are case-sensitive.
6. Set the CMS experience's `FxFlagKey` to `learning_hero`.
7. Configure the rule, audience, and traffic allocation in the intended FX environment, then start the experiment.
8. Use a known visitor or demo identity to inspect both the decision and rendered headline.

The official integration also maps a string variable to the CMS variation. However, its React SDK/example routing is not identical to this repository's architecture, which uses the core SDK and a server resolver. [Official FX/CMS integration](https://docs.developers.optimizely.com/feature-experimentation/docs/configure-optimizely-cms-saas).

The current resolver treats `Original`/`off` as default content. It has a legacy variation-key fallback when the variable is missing; do not rely on that fallback in a new setup. The SDK key, flag, rule, and Graph variation must belong to the intended environment.

## 5.2 Identity and tracking

[proxy.ts](../../proxy.ts) establishes the canonical `optimizely_user_id` cookie. The [browser client](../../lib/fx/browser-client.ts), [tracking component](../../components/tracking/OptimizelyTracking.tsx), and server resolver are wired to use the same identity. Allowed demo attribute-cookie keys are defined in [identity.ts](../../lib/fx/identity.ts).

ThemeManager integration fields:

| Setting | Connection |
|---|---|
| `featureExperimentationSdkKey` | Server/browser FX client |
| `webExperimentationProjectId` | Browser experimentation script |
| `odpPublicKey` | ODP tracker, identity, and events |
| `googleAnalyticsId` | GA4 script |
| `peeriusScriptUrl` | Product Recommendations |
| `contentRecsApiKey` | Server-side content recommendation fetch |
| `contentRecsClientId`, `contentRecsDeliveryId` | Idio tracking |

Script injection lives in [app/layout.tsx](../../app/layout.tsx). Tracking is suppressed in preview mode, so missing analytics events from CMS preview do not by themselves indicate public tracking failure. Verify script loading, network delivery, the product's event console, and identity matching separately.

The FX client's current datafile cache TTL is 5 seconds. `/api/fx-refresh` resets the cache in the server instance handling the request; it does not guarantee global invalidation across all serverless instances. When configured, the secret enables POST signature verification. The current implementation also supports a manual GET reset and POST without a configured secret.

## 5.3 Recommendations

- Content recommendations: [block](../../components/blocks/ContentRecommendationsBlock.tsx) and [fetch helper](../../lib/recommendations/contentRecs.ts).
- Product recommendations: [server block](../../components/blocks/ProductRecommendationsBlock.tsx), [client](../../components/blocks/ProductRecommendationsClient.tsx), and the Peerius script/callback.

Configure in this order: recommendation product account/data → ThemeManager settings → CMS block placement/settings → public page request → returned recommendations. Seeing cards in the UI does not prove personalization; inspect the actual provider response and fallback behavior.

## 5.4 Forms: from authoring to storage

```text
CMS OptiForms container + elements
  → frontend FormWrapper / fields
  → configured Submit URL
  → POST /api/form-submit
  → validation/rate checks
  → KV submissions list
```

For this SaaS Forms integration, the application owns submission storage. `OptiForms*` types belong to the Forms product and are excluded from CLI push in [optimizely.config.mjs](../../optimizely.config.mjs). Runtime registration is enabled only when `NEXT_PUBLIC_OPTIFORMS_ENABLED === 'true'`. Setting the flag does not provision Forms in the CMS instance.

Steps:

1. Confirm that Forms and its types exist in the target CMS instance.
2. Set the runtime flag and rebuild.
3. Add fields such as textboxes and an appropriate submit button to a form container.
4. Set Submit URL to `https://<site>/api/form-submit`.
5. Configure KV/Redis.
6. Submit test data and inspect the response and stored record.
7. Confirm that `CONTACT_EXPERIENCE_KEY` in the [contact page](../../app/(site)/contact-us/page.tsx) points to the intended form experience.

The receiver accepts JSON/form data but does not store file uploads. It includes a 40-field limit, JSON body-size checking, scalar normalization, and a rate counter. Storage retains the newest 500 entries. The list has a 90-day TTL refreshed on writes; this is not an independent 90-day expiry for each record. The memory fallback is not durable. Sources: [handler](../../app/api/form-submit/route.ts), [store](../../lib/formSubmissionStore.ts), and [FormWrapper](../../components/forms/FormWrapper.tsx).

`OT_QuoteForm` and `OptiFormsContainerData` are different content types/paths. Inspect their adapters/UI instead of assuming identical submission behavior.

## 5.5 Custom admin dashboard

Entry: `/opti-admin/login`. This is the project's custom application, not the Optimizely CMS administration interface. Credentials come from `OPTI_ADMIN_USER` and `OPTI_ADMIN_PASSWORD`; cookie/session logic lives in [auth.ts](../../lib/admin/auth.ts).

| Feature | Files | External dependency |
|---|---|---|
| Content calendar | `components/admin/ContentCalendarClient.tsx`, `lib/admin/graph.ts` | CMS Graph data |
| Component usage | `components/admin/ComponentUsageClient.tsx` | Graph composition content |
| Work requests | `components/admin/WorkRequestClient.tsx`, `lib/cmpApi.ts` | CMP templates and work-request API |
| Traffic simulator | `components/admin/TrafficSimulator.tsx`, `lib/demo/` | Configured tracking/ODP |
| Experiment simulator | `components/admin/ExperimentSimulator.tsx`, `lib/optimizely/rest.ts` | Experimentation REST access |

The presence of a calendar does not imply a fully synchronized CMP campaign calendar. This calendar endpoint uses the Graph helper `getCalendarItems`; the CMP work-request integration is separate.

Work-request setup: create/select a CMP request template → grant API application access → load templates in admin → complete required fields → submit → verify the created request/assignee in CMP. Field choices can arrive through `type_specific_meta.choices`; normalization lives in [cmpWorkRequests.ts](../../lib/admin/cmpWorkRequests.ts). Because this is an experimental API surface, verify the shape against the tenant's response.

## 5.6 Demo data and BigQuery

The project contains `lib/demo/personas.ts`, `randomUser.ts`, `products.ts`, and simulator/state helpers. These represent demo visitor/product data, not a real banking or customer backend.

BigQuery path:

```text
Admin simulator → lib/bq/sync.ts → /api/bq/customer-event
  → admin session validation
  → customer_events + customer_products
  → summary/current views
```

Configure a Google Cloud project/dataset and the required service-account permissions, then set `BQ_SERVICE_ACCOUNT_JSON` and `BQ_DATASET` in the server environment. `lib/bq/client.ts` initializes the client; event/product helpers handle schema and writes. The endpoint requires an authenticated admin session.

For practice, send a uniquely identifiable demo event and find its row in BigQuery. This implementation is not evidence of a Databricks integration. The README records Databricks-native analytics, a micro frontend proof point, and Azure Front Door work as unfinished.

## 5.7 Search, SEO, languages, and directories

| Feature | Code anchor | CMS/external work |
|---|---|---|
| Search | `app/api/search/`, `components/search/`, `lib/search.ts` | Published/indexed content and query coverage |
| SEO metadata | `lib/metadata.ts` | Page SEO fields and ThemeManager defaults |
| JSON-LD | `lib/structured-data.ts`, `components/seo/JsonLd.tsx` | schemaType, pageAnswer, and block data |
| Sitemap/robots | `app/sitemap.ts`, `app/robots.ts` | Site URL, noIndex, and published site scope |
| AI-readable index | `app/llms.txt/route.ts` | Public site origin/content |
| Language | `proxy.ts`, `i18n/`, `lib/i18n/` | CMS translations and hostname/locale mappings |
| Redirects | `lib/redirects.ts` | Graph redirect data and caching |
| Locations/maps | `lib/locations.ts`, `lib/geocode.ts`, location components | CMS profiles/site association and Mapbox token |
| Practitioners | `lib/practitioners.ts`, practitioner components | Profiles and practice-area data |
| Events | `lib/events.ts`, event page/listing | Event fields and published content |
| Resource library | `lib/resourceLibrary.ts`, ResourceLibrary block | DAM-indexed documents/assets |
| Topic hubs/campaigns | `lib/topicHub.ts`, `lib/campaign.ts`, page renderers | Corresponding page fields/references |

The supported locale list is `en`, `es`, `fr`, `de`, and `sv`. Swedish support does not mean every static UI label has been translated into Swedish; an English fallback remains. Adding a locale requires coordinated checks of config, messages/fallbacks, CMS language, page translations, and application host mappings.

The mortgage calculator's UI/model lives in `components/blocks/mortgage/` together with its block schema/settings. Chart rendering lives in `components/blocks/chart/`; JSON parsing, empty states, and display settings are separate concerns. When changing calculations, verify meaningful input/output cases.

## 5.8 Interpreting implementation status

“Implemented” means the files/logic exist. “Configured” means tenant/environment values are present. “Verified” means a specific test produced the expected result. “Production-ready” means deployment, access, data lifecycle, and operational requirements have been met. These terms are not interchangeable.
