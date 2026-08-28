import { displayTemplate } from '@optimizely/cms-sdk'

export const OT_QuoteDefault = displayTemplate({
  key: 'OT_QuoteDefault',
  displayName: 'Quote Default',
  contentType: 'OT_QuoteBlock',
  isDefault: true,
  settings: {
    color: {
      displayName: 'Background color',
      editor: 'select',
      sortOrder: 10,
      choices: {
        brand:   { displayName: 'Brand (Default)',                    sortOrder: 5  },
        none:    { displayName: 'Transparent (inherit row/section)', sortOrder: 10 },
        canvas:  { displayName: 'Canvas',                            sortOrder: 20 },
        surface: { displayName: 'Surface',                           sortOrder: 30 },
      },
    },
    alignment: {
      displayName: 'Alignment',
      editor: 'select',
      sortOrder: 20,
      choices: {
        center: { displayName: 'Centered (Default)', sortOrder: 10 },
        left:   { displayName: 'Left',               sortOrder: 20 },
      },
    },
    size: {
      displayName: 'Quote scale',
      editor: 'select',
      sortOrder: 30,
      choices: {
        large: { displayName: 'Large (Default)', sortOrder: 10 },
        small: { displayName: 'Small',           sortOrder: 20 },
      },
    },
  },
})
