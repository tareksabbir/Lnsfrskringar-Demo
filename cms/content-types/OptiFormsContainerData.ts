import { contentType } from '@optimizely/cms-sdk'
import { OptiFormsDependencyRule } from './OptiFormsDependencyRule'

/**
 * The form itself — a shared block an editor creates, then drags into an
 * experience. Server-owned; see any OptiForms*Element for the full note.
 *
 * `SubmitUrl` is the whole submission mechanism: POST the collected values to
 * it as a flat object. There is no token and no separate endpoint to configure
 * — the URL arrives with the content.
 */
export const OptiFormsContainerData = contentType({
  key: 'OptiFormsContainerData',
  displayName: 'Form Container',
  baseType: '_section',
  compositionBehaviors: ['sectionEnabled'],
  properties: {
    Title:                            { type: 'string',  isLocalized: true },
    Description:                      { type: 'string',  isLocalized: true },
    SubmitUrl:                        { type: 'url' },
    ShowSummaryMessageAfterSubmission:{ type: 'boolean' },
    SubmitConfirmationMessage:        { type: 'string',  isLocalized: true },
    ResetConfirmationMessage:         { type: 'string',  isLocalized: true },
    DependencyRules:                  { type: 'array', items: { type: 'component', contentType: OptiFormsDependencyRule } },
  },
})
