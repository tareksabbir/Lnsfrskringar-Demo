# Product

## Register

brand

## Site Purpose

**Site Accelerator** is a configurable, multi-vertical site framework built on Next.js App Router and the Optimizely SaaS CMS. It is not a single brand site; it is a system for standing up credible, editorially confident marketing sites for any vertical (financial services, healthcare, retail, legal, and more) by re-theming and composing one shared component library through ThemeManager, Visual Builder, and display templates.

Its primary job is pre-sales enablement: Optimizely solution engineers configure it to show a prospect, in that prospect's own vertical, what the SaaS CMS can do (Visual Builder composition, theme management, display templates, headless delivery). A demo that looks like a real, well-designed site in the prospect's industry is far more persuasive than a generic template.

### Current instance: Länsförsäkringar Stockholm

This repo is not the framework in the abstract — it is a working **Länsförsäkringar Stockholm (LF)** demo built on it, and the LF re-skin occupies the default token slot in `styles/tokens.css`. That is the framework working as intended: a real customer's brand reached through configuration.

The LF demo carries its own brief on top of the framework's, because it exists to answer specific architecture questions with something running rather than with slides — headless content delivery through Graph, DAM as the single source of truth for assets, and editors composing pages themselves in Visual Builder. [README.md](README.md) tracks what is built and what is not.

The framework requirements below still govern. Where the two conflict, the conflict is noted rather than resolved silently — see the navy note under **Anti-references**.

## Users

**Solution engineers / pre-sales (primary)**: Re-skin and re-compose the framework to present it to prospects across verticals. They need to land quickly on a site that looks native to the prospect's industry and tell a credible "you could build this" story.

**Prospects / demo audiences**: Evaluators in a specific vertical judging whether the result looks credible for their industry, and whether it could be their site.

**Developers / partners (secondary)**: Inspect the codebase, content types, and authoring experience to assess integration quality and real-world patterns.

## Product Purpose

A vertical-agnostic reference framework that simultaneously functions as:
- A re-themeable marketing-site system that can convincingly become a financial services, healthcare, retail, or legal site through configuration, not code changes.
- A live demonstration of Visual Builder composition, ThemeManager re-skinning, dynamic content types, display templates, and headless delivery.
- A best-practices template for Next.js 16 + Optimizely SDK integration.

Success: a solution engineer re-themes the framework for a prospect's vertical in minutes, and the result is indistinguishable from a purpose-built site for that industry.

## Brand Personality

Adaptable, precise, quietly confident. The character is its range: the confidence to become any vertical convincingly rather than to impose one industry's energy. Voice is editorial and credible, never hype-driven. The default theme is bold and forward-moving, but boldness is a setting, not the identity; craft, restraint, and theme-fidelity are the constants.

## Anti-references

- **Generic SaaS cream**: off-white grounds, rounded pill cards, pastel gradient blobs, floating feature-icon grids. The category reflex for "tech demo"; avoid.
- **Corporate enterprise blue**: navy/grey palettes, stock-photo heroes, "solutions for the modern enterprise" tone.
- **Generic CMS demo**: lorem ipsum, neutral placeholder content, flat card grids that telegraph "template."
- **Vertical cliché-by-reflex**: the first-guess look for each industry (healthcare teal-on-white, financial services navy-and-gold, legal mahogany-and-serif, retail loud-discount-banners). Each vertical theme must be credible without being its category's obvious training-data default.

> **On navy.** The LF theme's brand colour is navy, which reads against both anti-references above. The distinction that matters: these prohibit navy as a *reflex* — the palette you reach for when you have not decided anything. LF's navy is a real brand's real colour, and it is applied as a committed anchor filling 30–60% of the surface rather than as enterprise chrome around white cards. Both prohibitions stand for any theme where the palette is being invented. Neither applies when a customer supplies one.

## Design Principles

1. **The theme is the brand.** Identity lives in tokens, never hardcoded. Any vertical becomes the brand by re-theming; nothing visually distinctive may be hardcoded.
2. **Convincing, not generic.** Re-skinning must look purpose-built for its vertical, not a neutral template with a swapped color. Avoid both blandness and category cliché.
3. **The craft is the evidence.** The framework persuades by looking too good to be boilerplate.
4. **Break the SaaS grid.** If it could ship unchanged on any startup homepage, it isn't distinctive.
5. **Configuration over code.** A new vertical site is reached through ThemeManager + Visual Builder, not by editing components.

## Accessibility & Inclusion

WCAG 2.1 AA minimum across all themes and verticals. Support `prefers-reduced-motion`. Every vertical theme must independently meet color-contrast requirements; theme overrides may not break AA.
