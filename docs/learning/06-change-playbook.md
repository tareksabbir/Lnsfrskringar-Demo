# 6. Where to Make Changes, Deploy, and Debug

[Contents](README.md) · [Next: Practice](07-practice.md)

## 6.1 Change matrix

| Task | Code | CMS | CMP/other system | Verify |
|---|---|---|---|---|
| Change Hero headline | Usually none | Edit/publish existing block | None | Public heading |
| Change Hero layout choice | Template/styling/UI for a new choice | Select/publish option | None | Preview/mobile |
| Add a Hero field | Schema + adapter + UI; inspect query needs | Push schema, fill field, publish | None | Graph field + UI |
| Add a new block | Seven artifacts plus optional helpers | Push schema, place, publish | None | Showcase + editor + public |
| Change logo/nav/footer | Layout code for new behavior | ThemeManager/footer item | DAM asset if needed | Site-wide chrome |
| Add a brand palette | Resolver/tokens for a new axis | ThemeManager values | Deployment site identity | Light/dark contrast |
| Change a CMP blog field | Mapper/types/render/query | Page schema if needed | Structured-content key/type | Preview + imported draft |
| Change CMP callback URL | Origin-specific code if needed | Check target container | Webhook/channel update + env | Actual event delivery |
| Add an Opal section | Mapper + discovery + probe | Required types/templates | Skill update + registry Sync | Resulting draft composition |
| Migrate domain | Env/canonical/filter audit | Application hosts + Graph sync | Callbacks, registries, deployment domains | URLs, preview, sitemap |
| Add a language | Locale config/messages/routing | Language, translations, host mapping | CMP locale mapping if needed | Switch + canonical + preview |
| Add an A/B variation | Existing code usually suffices | Variation + FxFlagKey | FX variable/rule/SDK environment | Decision and content |
| Add a form | Little/none when reusing existing fields | Forms container + Submit URL | KV, Forms enablement | Stored submission |
| Add map view | Code for custom UX | Location data | Mapbox token | Map/geocoding |
| Add a page type | Schema/query/renderer/route coverage | Schema + content | None | Route/search/sitemap/preview |

## 6.2 Step-by-step recipe for a new block

The project's [block-authoring skill](../../.agents/skills/optimizely-block/SKILL.md) provides detailed development conventions. This guide explains the workflow; it has not created or pushed a block/schema.

Suppose you want to add `OT_LearningCardBlock`.

1. Read **every layer** of a similar existing block. Use `OT_StatBlock` for arrays/styling and Hero for basic mapping.
2. In `cms/content-types/OT_LearningCardBlock.ts`, define the type key, `_component` base, supported composition behaviors, and properties.
3. In `cms/display-templates/OT_LearningCardDefault.ts`, define visual options. Follow the project's separation of content configuration from display settings.
4. In `cms/components/OT_LearningCardBlock.tsx`, implement `ContentProps`, `getPreviewUtils`, defaults, and URL/image mapping.
5. In `components/blocks/LearningCardBlock.tsx`, implement presentation without a CMS SDK dependency.
6. Update the display-template, content-type, and React-component registries in `cms/registry.ts`. Importing a file alone does not register it.
7. Add demo lookup/render integration to `app/(site)/showcase/blocks/[block]/page.tsx`.
8. Add the matching kebab-case navigation slug to `app/(site)/showcase/config.ts`.
9. Add a styling helper, structured-data collector support, and localized labels where needed.
10. Run local checks, inspect the dry-run manifest, push the schema to the correct tenant, wait for Graph sync, build, and verify actual CMS placement/preview.

The seven artifacts are the schema, template, adapter, UI, registry integration, showcase demo, and showcase navigation. A styling helper is additional. Type keys, template `contentType`, and registry keys must refer to the same identity.

### Schema pitfalls

- Enum entries use `value`; do not substitute `key` without checking the SDK pattern.
- `maxLength` belongs at property level; localized text uses `isLocalized`.
- Rich-text fields use `richText`; do not copy older `xhtml` examples.
- Existing CTA patterns use a string label plus a URL field.
- `allowedTypes: []` is not a shortcut for image references; it can cause the SDK to generate a broad query.
- Custom property groups must exist in `optimizely.config.mjs`.
- Do not push built-in `OptiForms*` types through the CLI.
- Renaming a content-type key is not a harmless refactor without a migration for existing content.

## 6.3 Walkthrough: changing an existing field

Suppose Hero needs a new editorial field named `supportingText`.

1. Add its field definition to the Hero schema.
2. Pass the value from the Hero adapter to a UI prop.
3. Add the UI prop and rendering markup using design tokens.
4. Add populated and empty examples to the showcase.
5. Update explicit Graph fragments if present; for SDK-generated queries, inspect registration/schema and verify the result.
6. Inspect the manifest and synchronize the tenant schema.
7. Enter a value on the CMS item, preview it, and publish.
8. Verify that the field renders correctly and that spacing remains sensible when empty.

Changing only a TypeScript type does not change the CMS editor form. Pushing only the schema does not make the browser render a new field.

## 6.4 Important REST write behavior

Rules recorded in the project's CMS version writer and scripted builds:

1. Send the required **complete property set** in a new-version payload. Do not assume omitted fields are merged from the previous version.
2. Include `displayName`.
3. If a successful response body is empty, inspect the pattern that obtains the version from the `Location` header.
4. Do not assume the last item in a versions list is the latest; filter by status, locale, and variation.
5. Creating a draft and publishing a version are separate operations.

References: [CMS REST helper](../../lib/cmsApi.ts), [home rebuild script](../../scripts/rebuild_lf_home_vb.py). Scripts can rewrite production content; read them before executing them. Rebuilding an existing homepage is not a shortcut for creating a new learning page.

## 6.5 Deployment order

There are three release surfaces: **frontend deployment**, **CMS schema synchronization**, and **content/settings publishing**. CMP/Opal/FX configuration is a fourth, separate operational surface.

1. Review the current diff and identify the target environment.
2. For a backward-compatible schema change, inspect the manifest and push it to the target CMS.
3. Verify that the Graph schema is indexed. Deploying code first can cause Unknown type/field errors.
4. Run lint, type checking, relevant regression checks, and the production build. A build may require external Graph or font/network access.
5. Check deployment environment variables and CMS site identity, then create a preview deployment.
6. Test CMS content/settings with the new frontend. Breaking changes need a coordinated migration and rollback plan.
7. Update product configuration when callback/discovery URLs change.
8. Run the final public smoke test: home, nested page, locale, blog, image, preview, form, and the relevant integration.

Code deployment rollback and CMS content-version rollback are separate. Restoring an older frontend does not restore deleted CMS properties/data. Plan migration/export and backward compatibility before removing schemas or renaming keys.

## 6.6 Diagnose symptoms

| Symptom | Check first | Then check |
|---|---|---|
| Every CMS page returns 404 | Graph single key and site origin | CMS Start Page/hosts and published content |
| Only one locale returns 404 | Published translation and Graph URL base | Locale mapping/config |
| Graph Unknown type/field | Schema push/index | Registry and query names |
| Block missing from Outline | Composition nesting/displayName | Placement behavior |
| Blank preview iframe | CSP frame ancestors and app URL | Communication script and console |
| Expired preview token | Fresh preview URL | Preserved key/version/locale |
| Preview click-to-edit fails | Adapter `pa()`/composition metadata | Bridge/custom renderer |
| CMS content write returns 403 | API scope | Target item access rights |
| CMP endpoint returns 503 | Callback secret | Missing configuration in response body |
| CMP preview returns 200 but is blank | Mapped payload and KV | Acknowledge/complete logs and asset auth |
| CMP acknowledgement returns 422 | `acknowledgedBy` versus documented contract | Validation response |
| CMP publish returns 200 but no item exists | `cmsWrite.status` | Event name, GUID, credentials/container |
| Republish creates duplicates | Durable content-GUID mapping | Concurrent first delivery |
| CMP article missing from `/blog` | `OT_BlogPage` versus `BlankExperience` | Listing query/target tree |
| Opal tool missing | Registry Sync/Active/Enabled in Chat | Discovery response/schema |
| Opal article created under wrong site | Returned container | Env overrides and CMS parent tree |
| Image missing after successful API save | Reference/source/resolved Graph URL | allowedTypes, DAM sync, loader |
| FX always serves original | ThemeManager SDK key and flag | Rule environment and exact variable/variation |
| Forms causes Graph 400 | Forms availability in the instance | Runtime gate and excluded built-in types |
| Form succeeds but data is missing | Durable KV configuration | Memory fallback/server restart |
| Sitemap contains localhost | Production SITE_URL | Fresh build and Graph origin/site filtering |
| Work-request fields are wrong | CMP template API shape | Normalization/dynamic field renderer |

## 6.7 Debug in a consistent order

Inspect one layer at a time: **source item → stored configuration → API response → mapper/query → UI**.

For a missing image: check that the DAM asset exists → CMS reference exists → Graph returns an image URL → the adapter's `src()` resolves → the browser's image request succeeds. Starting with CSS can distract from the actual failure.

Remove secrets, preview tokens, and visitor form data before sharing logs. Current CMP inspection endpoints can expose payloads; do not use confidential content as learning samples.

## 6.8 Learning instructions versus live verification

Creating this documentation did not change application code or tenant settings. This guide does not claim that existing tests/builds passed during its preparation. The commands are recipes for verifying future changes. Test results in the earlier [routing audit](../cms-routing.md) describe that audit's snapshot.
