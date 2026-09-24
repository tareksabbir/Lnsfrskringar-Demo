# 7. Hands-on Labs and Knowledge Checks

[Contents](README.md) · [Complete source-file inventory](08-file-inventory.md)

Keep a learning notebook. For each lab, record the environment, content key, expected result, observed result, and any rollback action. Do not record secrets. These are instructions for exercises; the labs were not run against the tenant while preparing this documentation.

## Lab 1 — Understand a page's data flow

**Time:** 30–45 minutes. **Requires:** Source-code access.

1. Read the homepage route, `lib/optimizely.ts`, and `lib/CompositionRenderer.tsx`.
2. Open Hero's schema, display template, adapter, and UI.
3. Trace the CMS headline to the rendered text.
4. Explain why the CTA URL is read through `.default`.

**Success criterion:** You can draw and explain the flow without reopening all five files.

## Lab 2 — Run the site locally

**Time:** 45–60 minutes. **Requires:** Graph read access and site configuration.

1. Configure local environment variables, install dependencies, and start the server.
2. Open the homepage and one CMS-driven nested page.
3. Write down the different purposes of SITE_URL, SITE_DOMAIN, and Graph origins.
4. Explore three blocks in `/showcase`.

**Success criterion:** Your site's page and navigation render without returning another application's content.

## Lab 3 — Create a page without code changes

**Time:** 45–60 minutes. **Requires:** CMS editing/publishing rights.

1. Create a `learning-demo` experience under a test parent.
2. Add Hero, text, FAQ, and a DAM image.
3. Edit the title and reorder a block in preview.
4. Publish the practice page and open its actual URL.
5. Optionally unpublish the page after the exercise. Do not delete shared assets.

**Success criterion:** The editor and public output match, and preview selection identifies the correct block.

## Lab 4 — Plan a CMS field change

**Time:** 30 minutes; optional implementation takes additional time.

Plan a supporting-text field for Hero. List changes to the schema, adapter, UI, and showcase. Identify which operations are local, which write a remote schema, and which publish content.

**Success criterion:** Your plan includes the complete workflow rather than only a component edit.

## Lab 5 — From CMP preview to CMS draft

**Time:** 60–90 minutes. **Requires:** A configured CMP test integration, CMS write access, and KV.

1. Create a structured article with a unique title.
2. Request CMP preview and inspect acknowledgement/completion results.
3. Publish to the configured channel.
4. Record the `cmsWrite` result and CMS draft key.
5. Edit and republish the same CMP item.
6. Check whether the same CMS key was updated.

**Success criterion:** CMP preview and the imported CMS draft display the same content, and you understand that CMS publishing is still needed for public delivery.

## Lab 6 — Create an article draft with Opal

**Time:** 45–60 minutes. **Requires:** Configured custom tools and skill.

Example prompt:

> Create an English test article draft for this site's learning demo. First use list_dam_images to inspect available images, then use create_blog_article. Include one text section, one accordion, and one callout. Do not publish it.

Verify the selected tool name, returned container, `BlankExperience` type, real DAM image, and editable composition. The article should not appear in the public `/blog` index before its draft is published.

## Lab 7 — Map an experiment to CMS content

**Time:** 60 minutes. **Requires:** An FX test environment and CMS variation access.

1. Give the test page's `LearningB` variation a different headline.
2. Configure the FX string variable with the exact required name/value.
3. Check the page's flag key and ThemeManager SDK key.
4. Use a known test audience/identity to view the variant.
5. Confirm the original appears when the rule is disabled or the default is selected.

**Success criterion:** You can explain the distinction between an FX variation key and the CMS variation-name variable. Seeing a changed heading once is not a statistically valid experiment result.

## Lab 8 — Forms and admin

**Time:** 45–60 minutes. **Requires:** A Forms-enabled CMS, test KV, and admin access.

1. Configure the test form's Submit URL.
2. Submit dummy values and verify success plus the storage entry.
3. Explore the admin calendar and component-usage view.
4. Create a work request using a CMP test template and verify the actual result in CMP.

**Success criterion:** You understand that form submissions, the CMS page calendar, and CMP requests follow separate data paths.

## Quiz

1. Does running `cms:push` change the homepage headline?
2. Why might a page created by CMP publishing be missing from `/blog`?
3. Why might Graph use a production origin when the frontend runs on localhost?
4. Does a 200 preview-webhook response prove that CMP preview completed?
5. What should you do when a newly added Opal tool is missing from the UI?
6. Which FX value must exactly match the CMS variation name?
7. Why can a local test work without KV while a serverless deployment fails?
8. Why can a CMS write return 403 even after obtaining an API token?
9. Which three registries are involved in a new block?
10. How do content tokens differ from CSS tokens?

## Answers

1. No. It synchronizes schemas/templates. The headline is a content-item value.
2. CMP creates `OT_BlogPage`, while the `/blog` index queries `BlankExperience`. Also inspect site/container/locale filtering.
3. Graph URLs come from CMS application host mappings, not the browser origin.
4. No. Inspect acknowledgement/completion results, the saved payload, and the rendered preview because the handshake is best-effort.
5. Sync the registry, then check Active, Enabled in Chat, and the discovery schema.
6. The value of the `cms-saas-content-variation` string variable.
7. Memory belongs to one process; another instance or a cold start does not share it.
8. API scope and access rights to the target content are separate.
9. Display-template, content-type, and React-component registries.
10. `{{key}}` performs content substitution; `--ot-*` defines CSS design values.

## Project handover checklist

| Record | Details to capture |
|---|---|
| CMS | Instance/environment, application ID, Start Page key |
| Routing | Public domain, CMS site domain, indexed Graph origins, locales |
| Content | ThemeManager key, footer key, both blog containers, contact key |
| Preview | Configured templates, reachable frontend origin, date of a successful sample preview |
| Credentials | Secret-manager entry name/owner, never the secret value |
| CMP | API app identity, preview/publish callback URLs, event subscriptions, field keys |
| DAM | Selected instance, enabled asset features, sample resolved asset |
| Opal | Registry name/discovery URL, enabled tools, skill binding |
| FX/ODP | Project/environment, SDK setting location, flag, variable, test identity method |
| Forms | Entitlement, runtime gate, Submit URL, persistence/retention owner |
| Deployment | Project/environment, build commands, environment-variable ownership |
| Verification | Observed results and dates; list unverified items separately |

## Continue learning

Use the [file inventory](08-file-inventory.md) to find feature implementations and the [change playbook](06-change-playbook.md) to scope your work. If older project records conflict with current official documentation, record the source, date, and actual tenant behavior before deciding which guidance applies.
