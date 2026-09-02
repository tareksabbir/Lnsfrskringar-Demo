import { contentType } from '@optimizely/cms-sdk'

/**
 * Comparison matrix — one row per feature, one column per plan.
 *
 * Exists because OT_ComparisonTableBlock cannot be placed in a composition: it
 * holds arrays of components, which bars it from `elementEnabled` ("The property
 * 'items' is not allowed when content type has ElementEnabled"), and a
 * `_component` is refused as a section's component. `_section` is not a way out
 * either — the SDK builds composition fragments only for `_component`
 * (isExperienceComponent in util/queryUtils.js), so a `_section` type renders
 * empty on the page even though the CMS and Graph both hold its data.
 *
 * So: `_component` + elementEnabled, and the grid held as flat string arrays,
 * since arrays of scalars are permitted where arrays of components are not.
 * `cells` is row-major and `columnLabels.length` turns it back into a grid.
 * Verbose for an editor, but it is the only shape that actually renders.
 */
export const OT_CompareTable = contentType({
  key: 'OT_CompareTable',
  displayName: 'Comparison Table',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled', 'sectionEnabled'],
  properties: {
    headline: {
      type: 'string', displayName: 'Heading', isLocalized: true, maxLength: 160,
      group: 'OT_Content', sortOrder: 10,
    },
    intro: {
      type: 'string', displayName: 'Intro (optional)', isLocalized: true, maxLength: 400,
      group: 'OT_Content', sortOrder: 20,
    },
    columnLabels: {
      type: 'array', displayName: 'Column headings', isLocalized: true,
      description: 'One per plan, left to right.',
      group: 'OT_Content', sortOrder: 30, items: { type: 'string' },
    },
    rowLabels: {
      type: 'array', displayName: 'Row headings', isLocalized: true,
      description: 'One per feature, top to bottom.',
      group: 'OT_Content', sortOrder: 40, items: { type: 'string' },
    },
    cells: {
      type: 'array', displayName: 'Cells', isLocalized: true,
      description:
        'Read left to right, row by row: every column of row 1, then every column of row 2. '
        + 'Use "yes" for a tick, "no" for a dash, or free text such as "Optional".',
      group: 'OT_Content', sortOrder: 50, items: { type: 'string' },
    },
  },
})
