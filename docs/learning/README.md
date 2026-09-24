# Complete Project Learning Guide

**Project:** Länsförsäkringar Stockholm / Site Accelerator  
**Audience:** Developers, solution engineers, CMS editors, and integration owners joining the project  
**Prepared:** September 23, 2026 · **English edition:** September 24, 2026

This guide explains how a page reaches the browser, how to create content in the CMS, and where to make changes across the codebase, CMS, CMP, DAM, Opal, and deployment configuration. Field names, file names, and product UI labels match the implementation so you can follow along directly.

## Reading order

| Step | Chapter | What you will be able to do |
|---|---|---|
| 1 | [Architecture and code walkthrough](01-architecture.md) | Explain request → Graph → renderer → component |
| 2 | [Local setup and configuration](02-setup.md) | Run the site locally with the correct CMS site identity |
| 3 | [CMS, Visual Builder, preview, and DAM](03-cms-and-dam.md) | Build pages, change the theme, and diagnose preview problems |
| 4 | [CMP and Opal integration](04-cmp-and-opal.md) | Understand preview/publish wiring and the two blog pipelines |
| 5 | [Other features and integrations](05-features.md) | Locate FX, forms, admin, search, and analytics functionality |
| 6 | [Changes, deployment, and troubleshooting](06-change-playbook.md) | Identify the code and external settings needed for a change |
| 7 | [Hands-on labs, quiz, and checklist](07-practice.md) | Check your understanding and prepare a project handover |
| Reference | [Complete source-file inventory](08-file-inventory.md) | Find routes, types, blocks, and scripts |

For your first pass, spend roughly 60–90 minutes on one step each day. This is a suggested study schedule; obtaining access or activating integrations takes additional time. For content editing, read chapters 1 → 3 → 4 → 7. For development, read all chapters in order.

## What has been verified

- **Current code:** Based on the implementation and configuration files in this repository.
- **Earlier project records:** Instance names, domains, and previous integration results come from the README and earlier audits. These are historical records; the live tenant was not retested while preparing this guide.
- **Official references:** Relevant Optimizely documentation was consulted online. Direct links appear in the corresponding chapters.
- **Check in your environment:** Confirm that connectors, entitlements, secrets, webhooks, workflows, and published content remain configured. No live CMS or CMP settings were changed while creating this documentation.

Complete tenant configuration does not live in Git. Repository inspection alone cannot prove that every integration works in production. This guide identifies the external settings and explains how to verify them.

## Six distinctions to remember

1. **Content type versus content item:** A type defines the schema/editor form; an item is an actual Hero or page created from that schema.
2. **Schema push versus publishing:** `cms:push` changes available fields/templates; it does not publish a page's text.
3. **Graph versus REST:** Graph reads content; the CMS Management REST API writes content and configuration.
4. **CMS preview versus CMP preview:** CMS preview reads drafts using a token/version; CMP preview stores a webhook payload and renders it on a separate page.
5. **Opal blog versus CMP blog:** Opal creates `BlankExperience` articles; CMP creates `OT_BlogPage` drafts. Their listing paths differ too.
6. **Local code versus external configuration:** Checking out Git does not create a CMS application, CMP webhook, Opal registry, or FX experiment.

## Important differences from older documentation

| Earlier assumption | Guidance to follow |
|---|---|
| An Opal registry must be deleted whenever its tools change | The current official UI has **More → Sync**. Sync first and verify the tool list. [Manage tools](https://support.optimizely.com/hc/en-us/articles/39329066565901-Manage-tools) |
| `cms:push` automatically bootstraps a first import | Bootstrap is **opt-in** in the executable code; an ordinary push does not force it |
| The frontend contains no content | Main pages are CMS-driven, but showcase examples, fallback labels, demo personas, and some static routes live in code |
| Every DAM reference uses the same string format | The Opal/composition and CMP federation paths differ; see [chapter 3](03-cms-and-dam.md) |
| A webhook 200 response means content was published | The CMP handler creates a draft; inspect `cmsWrite` and the CMS item |
| There is no test runner | `node --test tests/routing.test.cjs` exists, although `package.json` has no `test` script |

## Glossary

| Term | Meaning |
|---|---|
| Headless | Content management and website rendering run in separate systems |
| CMS | Manages pages, blocks, themes, and publishing |
| CMP | Manages marketing content, requests, workflows, and channel publishing |
| DAM | A library for image, document, and video assets |
| Graph | Delivery API for querying indexed content |
| Composition | A tree of sections, rows, columns, and blocks |
| Adapter | Converts CMS data into UI component props |
| Webhook | An HTTP request sent to another system when an event occurs |
| OAuth client credentials | A server obtains an access token using its client ID and secret |
| Locale | Content language/region, such as `en` or `sv` |
| FX | Feature Experimentation; selects flags/variations for visitors |
| ODP | Optimizely Data Platform; identity, event, and audience integration |
| KV | Key-value storage that retains data after a request finishes |
| Idempotency | The intention to update the same item when a delivery repeats; this project uses a mapping, not a transaction-level guarantee |

Additional technical references: [project README](../../README.md), [Optimizely patterns](../../Optimizely.md), [routing](../cms-routing.md), [blog/Opal](../blog-and-opal.md), and [structured data](../structured-data.md).
