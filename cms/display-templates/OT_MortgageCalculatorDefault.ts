import { displayTemplate } from '@optimizely/cms-sdk'

/**
 * Display settings for the mortgage calculator: presentation only.
 *
 * Which sections the form asks about is *not* here — the three "Hide …"
 * switches are properties on the block itself (see the content type), where an
 * editor looks for them. They lived here first, and having them in both places
 * meant either control could silently override the other.
 *
 * Booleans are `select` choices with 'true' / 'false' keys because CMS choice
 * keys must be at least two characters; the styling helper coerces them.
 */
export const OT_MortgageCalculatorDefault = displayTemplate({
  key:         'OT_MortgageCalculatorDefault',
  displayName: 'Mortgage Calculator',
  contentType: 'OT_MortgageCalculatorBlock',
  isDefault:   true,
  settings: {
    color: {
      displayName: 'Background',
      sortOrder:   40,
      editor:      'select',
      choices: {
        surface: { displayName: 'Surface (Default) — grey ground, white cards', sortOrder: 10 },
        canvas:  { displayName: 'Canvas — cards on the page background',        sortOrder: 20 },
      },
    },
    stickyPanel: {
      displayName: 'Result panel follows the reader',
      sortOrder:   50,
      editor:      'select',
      choices: {
        true:  { displayName: 'Sticky (Default)', sortOrder: 10 },
        false: { displayName: 'Static',           sortOrder: 20 },
      },
    },
  },
})
