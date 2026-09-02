import { displayTemplate } from '@optimizely/cms-sdk'

export const OT_QuoteFormDefault = displayTemplate({
  key: 'OT_QuoteFormDefault',
  displayName: 'Quote Form Default',
  contentType: 'OT_QuoteForm',
  isDefault: true,
  settings: {
    platePrefix: {
      displayName: 'Show plate badge on field 1',
      editor: 'select',
      sortOrder: 10,
      choices: {
        true:  { displayName: 'Yes (Default)', sortOrder: 10 },
        false: { displayName: 'No',            sortOrder: 20 },
      },
    },
  },
})
