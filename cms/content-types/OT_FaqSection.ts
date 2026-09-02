import { contentType } from '@optimizely/cms-sdk'
import { OT_AccordionItem } from './OT_AccordionItem'

/**
 * FAQ — an accordion that can actually be placed on a page.
 *
 * WHY THIS EXISTS ALONGSIDE OT_AccordionBlock
 * OT_AccordionBlock is `baseType: '_component'` with `sectionEnabled`, and on
 * this CMS that combination has no legal position:
 *
 *   - a column accepts only `elementEnabled` components;
 *   - `elementEnabled` cannot be granted to it, because the CMS refuses
 *     "The property 'items' is not allowed when content type has
 *     ElementEnabled" — and `items` is exactly what makes it an accordion;
 *   - a section node's component must have `baseType: '_section'`, so offering
 *     a `_component` there fails with "The component type is not based on
 *     section base type."
 *
 * So the block exists, renders, and no editor can add it to a page. The same
 * trap catches every array-based block here: FeatureGrid, StatBlock, Tabs,
 * ComparisonTable, Disclosure, TrustRail.
 *
 * `_section` is the way out. A section type may hold an array of components —
 * verified against the live instance — because the ElementEnabled restriction
 * simply does not apply to it. The React component is shared with
 * OT_AccordionBlock, so this is a placement fix, not a second implementation.
 */
export const OT_FaqSection = contentType({
  key: 'OT_FaqSection',
  displayName: 'FAQ Section',
  baseType: '_section',
  compositionBehaviors: ['sectionEnabled'],
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
    items: {
      type: 'array',
      displayName: 'Questions',
      description: 'Each row is a question and its answer. Rows are collapsed until clicked.',
      group: 'OT_Content',
      sortOrder: 30,
      items: { type: 'component', contentType: OT_AccordionItem },
    },
  },
})
