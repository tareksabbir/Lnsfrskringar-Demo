import { displayTemplate } from '@optimizely/cms-sdk'

/**
 * Mirrors OT_AccordionDefault — both templates drive the same React component,
 * so the settings vocabulary is deliberately identical. `boxed` is the default
 * here rather than `ruled`: on a product page each question reads as its own
 * card, which is what the LF reference shows.
 */
export const OT_FaqSectionDefault = displayTemplate({
  key: 'OT_FaqSectionDefault',
  displayName: 'FAQ Section Default',
  contentType: 'OT_FaqSection',
  isDefault: true,
  settings: {
    color: {
      displayName: 'Background',
      editor: 'select',
      sortOrder: 10,
      choices: {
        surface: { displayName: 'Surface (Default)', sortOrder: 10 },
        canvas:  { displayName: 'Canvas',            sortOrder: 20 },
        brand:   { displayName: 'Brand',             sortOrder: 30 },
      },
    },
    borderStyle: {
      displayName: 'Row style',
      editor: 'select',
      sortOrder: 20,
      choices: {
        boxed: { displayName: 'Cards (Default)', sortOrder: 10 },
        ruled: { displayName: 'Ruled',           sortOrder: 20 },
        clean: { displayName: 'Clean',           sortOrder: 30 },
      },
    },
    openMode: {
      displayName: 'Open behaviour',
      editor: 'select',
      sortOrder: 30,
      choices: {
        single:   { displayName: 'One at a time (Default)', sortOrder: 10 },
        multiple: { displayName: 'Several at once',         sortOrder: 20 },
      },
    },
    defaultOpen: {
      displayName: 'First row open on load',
      editor: 'select',
      sortOrder: 40,
      choices: {
        false: { displayName: 'No (Default)', sortOrder: 10 },
        true:  { displayName: 'Yes',          sortOrder: 20 },
      },
    },
  },
})
