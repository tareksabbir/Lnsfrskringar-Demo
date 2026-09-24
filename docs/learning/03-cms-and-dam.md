# 3. CMS, Visual Builder, Preview, and DAM

[Contents](README.md) · [Next: CMP and Opal](04-cmp-and-opal.md)

## 3.1 What must be configured outside the code

| CMS setting/content | Why it is needed | Frontend connection |
|---|---|---|
| Application and Start Page | Identifies the website's content tree | Homepage/path lookup |
| Application Hostnames and language mappings | Controls Graph URLs and locale resolution | Site-origin filtering |
| Preview URL template | Tells the editor which frontend URL to open | `/api/draft`, `/preview` |
| API client and access rights | Enables REST reads/writes | Schema sync, Opal, CMP import |
| Published content types/templates | Defines Graph schema and editor choices | `cms/` definitions |
| `OT_ThemeManager` content item | Holds site-specific navigation/theme/integrations | Layout/settings query |
| Blog folders | Places articles in the correct site tree | Two container env variables |
| DAM instance and enabled asset types | Enables CMS asset selection | Image references/Graph |
| Graph synchronization | Indexes the latest schema/content | All delivery queries |

Open **Settings → Applications** in the CMS. Start Page, hostnames, and preview settings belong to the application; repository folders do not create them. [Official application documentation](https://docs.developers.optimizely.com/content-management-system/v1.0.0-CMS-SaaS/docs/applications).

## 3.2 Verify an existing tenant

1. Open the correct CMS instance/environment. The README records `lans01saas / Production1` as the historical demo identity; confirm the instance you actually have access to.
2. Find your site's Start Page in Applications. Do not confuse Stockholm and Skåne on the shared instance.
3. Record the default and language-specific Hostnames values.
4. Compare them with the frontend's domain/origin environment settings.
5. In the CMS Graph explorer, inspect the key, locale, and URL of a known published page.
6. Changing hostnames can require Graph Full Synchronization. Testing against stale indexed URLs can be misleading. See the project-specific [routing guide](../cms-routing.md).

## 3.3 Create your first page: editor walkthrough

Use a test folder/page for this exercise. These steps create content; use a separate learning page instead of editing the production homepage.

1. Select an appropriate parent under your application's Start Page.
2. Create a `BlankExperience`, name it `Learning Demo`, and set its URL segment to `learning-demo`.
3. Add a Section in Visual Builder and give it a clear display name, such as `Intro`.
4. Add Row → Column → Hero. A component needs `elementEnabled` to be placed in a column.
5. Enter the headline, body, CTA label, and URL.
6. Select a DAM asset through the image picker and provide alternative text.
7. Choose layout/color/animation options from the display template.
8. Add a second section containing Rich Text or FAQ content.
9. Fill in the SEO title/description. Set `noIndex` if the practice page should not appear in search engines.
10. Check desktop/mobile preview. Clicking the headline should select the appropriate field/block.
11. Publish after review. Saving a draft does not update the public website. [Official publishing workflow](https://docs.developers.optimizely.com/content-management-system/v1.0.0-CMS-SaaS/docs/publish-versions-of-content).
12. Open the CMS “View on website” URL and verify the title, image, CTA, and locale. If Graph indexing is delayed, query again after allowing time for synchronization.

Earlier scripted compositions in this project showed that flat components could render while failing to appear correctly in Visual Builder's Outline. Follow experience → section → row → column → component. Not every block supports every placement; inspect `compositionBehaviors`.

## 3.4 CMS preview wiring

```text
CMS preview template
  → /api/draft/{context}?key=...&ver=...&loc=...&path=...&preview_token=...
  → draft mode + preserved preview parameters
  → page route / standalone preview
  → SDK preview content fetch
  → PreviewBridge + edit attributes
```

This illustrates a project-compatible pattern. Compare it with the tenant's actual configured template. Do not insert a permanent token string manually. The vendor's default preview URL and this project's draft-entry URL are different configurations.

Key files:

- [Draft entry](../../app/api/draft/route.ts) and [context path entry](../../app/api/draft/[...slug]/route.ts)
- [Preview page](../../app/preview/page.tsx), [block preview](../../app/(draft)/draft/[version]/block/[key]/page.tsx)
- [PreviewBridge](../../components/preview/PreviewBridge.tsx), [OnPageEdit](../../components/draft/OnPageEdit.tsx)
- [Preview navigation](../../lib/previewNavigation.ts), [CompositionRenderer](../../lib/CompositionRenderer.tsx)
- [next.config.ts](../../next.config.ts): permitted CMS/CMP framing origins

The official live-preview contract involves application URL configuration, the CMS communication script, editable-element attributes, and refreshing after content changes. The SDK `pa()` helpers and project bridge implement parts of that contract. A `contentSaved` refresh must use the new preview URL/token. Preview tokens are short-lived; open a fresh CMS preview instead of reusing an old copied link. [Official live preview](https://docs.developers.optimizely.com/content-management-system/v1.0.0-CMS-SaaS/docs/enable-live-preview-saas).

Key, version, locale, and context identify different aspects of a preview request. Looking up drafts by public slug alone can select the wrong version. The current project shows an unavailable/retry state when preview fetching fails rather than substituting a published homepage.

## 3.5 Change the theme, header, or footer

1. Find the site's `OT_ThemeManager` item in the CMS.
2. Confirm that `frontEndDomain` matches the site identity.
3. Inspect brand/logo, navigation, theme axes, and integration fields.
4. Edit navigation items/sub-items in the CMS. The referenced `OT_FooterBlock` may be a separate content item; open it too.
5. Publish and verify the frontend. Editing the homepage Hero alone does not change the site-wide brand.

Code path: [ThemeManager schema](../../cms/content-types/OT_ThemeManager.ts) → [settings resolver](../../lib/optimizely.ts) → [root layout](../../app/layout.tsx) / [site layout](../../app/(site)/layout.tsx) → `components/layout/`.

Default design values live in [tokens.css](../../styles/tokens.css). [theme-axes.ts](../../lib/theme-axes.ts) defines valid font, corner, motion, and navbar choices. Tailwind v4 bindings live in [globals.css](../../app/globals.css); you do not need to find or create `tailwind.config.js` to change the theme.

**CSS tokens and content tokens differ:** `--ot-brand` is a CSS design token; `{{supportPhone}}` is a content placeholder. `OT_TokenManager`, [tokens.ts](../../lib/tokens.ts), and [token-replace.ts](../../lib/token-replace.ts) handle content substitution. Unknown placeholders remain unchanged so authors can spot mistakes.

## 3.6 DAM setup and image delivery

In **Settings → Optimizely DAM Features**, select the correct DAM instance and activate/save the required asset features. The DAM/Graph integration delivers asset data through content references. [Official onboarding](https://docs.developers.optimizely.com/content-management-system/v1.0.0-CMS-SaaS/docs/onboard-dam-to-cms-saas).

Then:

1. Find or add a test image in DAM. Give it a meaningful title and relevant metadata.
2. Open the DAM picker from a CMS Image/Hero field. The first use may require a DAM login.
3. Select the asset and inspect the draft preview.
4. Publish, then inspect the resolved URL in Graph and the browser's image request.
5. Manage reused asset metadata and lifecycle in DAM.

The DAM picker is available for supported content-reference/image properties; allowed types matter. [Official picker guide](https://docs.developers.optimizely.com/content-management-system/v1.0.0-CMS-SaaS/docs/dam-assets).

### Reference formats: two project paths

| Path | Current implementation |
|---|---|
| Opal/composition image creation | Uses a reference pattern containing `DamImageSource`; see `lib/blogComposition.ts` and `lib/damImages.ts` |
| CMP-to-typed-blog import | Sends `cms://content/<asset_guid>` as a federation reference from `app/api/cmp-publish/route.ts` |

Do not turn this distinction into a universal vendor rule. A reference being accepted by the CMS API does not prove that the image will resolve. Verify **write → resolved Graph item/URL → rendered image** for the target field, schema, and source.

Image rendering uses the custom loader in [lib/imageLoader.ts](../../lib/imageLoader.ts); the default Next image optimizer is not the main path here. The project's DAM CDN path uses the `width` parameter. If the CDN host or transformation behavior changes, inspect the loader and real responses.

## 3.7 Asset lineage: where an image is used

`CMS content publish → /api/cms-publish → lib/assetLineage.ts → CMP lineage write`

The webhook resolves the public page URL from a content key and collects DAM references from published versions. A local ledger prevents repeated lineage registration. The optional CMS webhook authentication token uses `Authorization: Bearer ...`; do not confuse it with CMP's `Callback-Secret` header.

Check the reachable endpoint, CMS publish-event subscription, CMP/CMS credentials, and durable KV configuration. The implementation supports `?dryRun=1` for collecting references without writing lineage. Sources: [CMS webhook handler](../../app/api/cms-publish/route.ts), [lineage helper](../../lib/assetLineage.ts). Comments record earlier live verification; retest webhook delivery and the DAM usage UI in the current tenant.

## 3.8 Check your understanding

Explain why the CMS application hostname may differ from the `.env.local` public URL. What is the difference between publishing a schema and publishing content? If an image appears in preview but not on the public page, which three layers would you inspect?
