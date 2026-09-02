import { displayTemplate } from '@optimizely/cms-sdk'

/**
 * No `borderStyle` here, unlike OT_AccordionDefault: FaqAccordion draws one row
 * treatment by design (a card per question), so there would be nothing to switch.
 */
export const OT_FaqBlockDefault = displayTemplate({
  key: 'OT_FaqBlockDefault',
  displayName: 'FAQ Default',
  contentType: 'OT_FaqBlock',
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
    openMode: {
      displayName: 'Open behaviour',
      editor: 'select',
      sortOrder: 20,
      choices: {
        single:   { displayName: 'One at a time (Default)', sortOrder: 10 },
        multiple: { displayName: 'Several at once',         sortOrder: 20 },
      },
    },
    defaultOpen: {
      displayName: 'First row open on load',
      editor: 'select',
      sortOrder: 30,
      choices: {
        false: { displayName: 'No (Default)', sortOrder: 10 },
        true:  { displayName: 'Yes',          sortOrder: 20 },
      },
    },
  },
})
