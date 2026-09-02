import { displayTemplate } from '@optimizely/cms-sdk'

export const OT_CompareTableDefault = displayTemplate({
  key: 'OT_CompareTableDefault',
  displayName: 'Comparison Table Default',
  contentType: 'OT_CompareTable',
  isDefault: true,
  settings: {
    color: {
      displayName: 'Background',
      editor: 'select',
      sortOrder: 10,
      choices: {
        surface: { displayName: 'Surface (Default)', sortOrder: 10 },
        canvas:  { displayName: 'Canvas',            sortOrder: 20 },
      },
    },
  },
})
