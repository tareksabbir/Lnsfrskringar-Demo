import { displayTemplate } from '@optimizely/cms-sdk'

export const OT_HeroDefault = displayTemplate({
  key: 'OT_HeroDefault',
  displayName: 'Hero Default',
  contentType: 'OT_HeroBlock',
  isDefault: true,
  settings: {
    layout: {
      displayName: 'Panel layout',
      editor: 'select',
      sortOrder: 10,
      choices: {
        imageRight: { displayName: 'Image Right (Default)', sortOrder: 10 },
        imageLeft:  { displayName: 'Image Left',            sortOrder: 20 },
      },
    },
    color: {
      displayName: 'Background color',
      editor: 'select',
      sortOrder: 20,
      choices: {
        brand:   { displayName: 'Brand (Default)', sortOrder: 10 },
        canvas:  { displayName: 'Canvas',          sortOrder: 20 },
        surface: { displayName: 'Surface',                sortOrder: 30 },
      },
    },
    animation: {
      displayName: 'Entrance animation',
      editor: 'select',
      sortOrder: 30,
      choices: {
        none:     { displayName: 'None (Default)', sortOrder: 10 },
        fade:     { displayName: 'Fade In',        sortOrder: 20 },
        slide:    { displayName: 'Slide Up',       sortOrder: 30 },
        parallax: { displayName: 'Parallax',       sortOrder: 40 },
      },
    },
  },
})
