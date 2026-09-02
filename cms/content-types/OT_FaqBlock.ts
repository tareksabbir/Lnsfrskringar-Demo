import { contentType } from '@optimizely/cms-sdk'

/**
 * FAQ — an accordion that both the CMS will place AND the SDK will query.
 *
 * Getting here took three wrong shapes, so the constraints are written down.
 *
 * 1. OT_AccordionBlock (`_component`, sectionEnabled only) cannot be placed at
 *    all. A column takes only `elementEnabled`; `elementEnabled` cannot be
 *    granted to it because the CMS refuses "The property 'items' is not allowed
 *    when content type has ElementEnabled"; and a section's component must be
 *    `_section`, so a `_component` is refused there too.
 *
 * 2. OT_FaqSection (`_section`, holding an array of OT_AccordionItem) IS
 *    accepted by the CMS and Graph returns its rows correctly — but the front
 *    end receives none of them. The SDK builds composition fragments from
 *    `isExperienceComponent` (util/queryUtils.js), which requires
 *    `baseType === '_component'`. A `_section` type is skipped, so its
 *    properties are never selected and the block renders empty. That is the
 *    trap: valid in the CMS, correct in Graph, blank on the page.
 *
 * 3. So the type must be `_component` + `elementEnabled`, which rules out an
 *    array of components. Arrays of STRINGS are allowed — verified against the
 *    live instance — hence two parallel arrays rather than a list of pairs.
 *    Row N of `questions` pairs with row N of `answers`; the renderer zips them
 *    and ignores any unmatched tail, so a half-finished edit degrades to fewer
 *    rows instead of throwing.
 *
 * The same reasoning applies to every other array-based block here
 * (FeatureGrid, StatBlock, Tabs, ComparisonTable, Disclosure, TrustRail): none
 * of them can currently be placed, and parallel scalar arrays are the only shape
 * that works without an SDK change.
 */
export const OT_FaqBlock = contentType({
  key: 'OT_FaqBlock',
  displayName: 'FAQ',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled', 'sectionEnabled'],
  properties: {
    eyebrow: {
      type: 'string',
      displayName: 'Eyebrow (optional)',
      isLocalized: true,
      maxLength: 80,
      group: 'OT_Content',
      sortOrder: 10,
    },
    headline: {
      type: 'string',
      displayName: 'Heading',
      isLocalized: true,
      maxLength: 160,
      group: 'OT_Content',
      sortOrder: 20,
    },
    questions: {
      type: 'array',
      displayName: 'Questions',
      description: 'One question per row. Row N pairs with answer N below.',
      isLocalized: true,
      group: 'OT_Content',
      sortOrder: 30,
      items: { type: 'string' },
    },
    answers: {
      type: 'array',
      displayName: 'Answers',
      description:
        'One answer per row, in the same order as the questions. Use a blank line for a paragraph break.',
      isLocalized: true,
      group: 'OT_Content',
      sortOrder: 40,
      items: { type: 'string' },
    },
  },
})
