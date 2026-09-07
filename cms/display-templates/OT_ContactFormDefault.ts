import { displayTemplate } from '@optimizely/cms-sdk'

export const OT_ContactFormDefault = displayTemplate({
  key:         'OT_ContactFormDefault',
  displayName: 'Contact Form Default',
  contentType: 'OT_ContactForm',
  isDefault:   true,
  settings: {
    color: {
      displayName: 'Background',
      editor:      'select',
      sortOrder:   10,
      choices: {
        surface: { displayName: 'Surface (Default)', sortOrder: 10 },
        canvas:  { displayName: 'Canvas',            sortOrder: 20 },
        tint:    { displayName: 'Brand tint',        sortOrder: 30 },
      },
    },
    // A contact form is a reading-width thing whichever column it sits in, but
    // a two-column layout suits a page that pairs the form with an address.
    layout: {
      displayName: 'Layout',
      editor:      'select',
      sortOrder:   20,
      choices: {
        stacked: { displayName: 'Stacked — labels above inputs (Default)', sortOrder: 10 },
        compact: { displayName: 'Compact — name and email side by side',   sortOrder: 20 },
      },
    },
  },
})
