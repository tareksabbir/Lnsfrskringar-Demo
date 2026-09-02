import { contentType } from '@optimizely/cms-sdk'

/**
 * The "get a price" panel in a product hero: a tick list, two labelled fields
 * and a call to action.
 *
 * Shape follows the rule the other new blocks established — `_component` +
 * elementEnabled, with repeating values held as parallel arrays of STRINGS. An
 * elementEnabled type may not hold an array of components, so the two fields are
 * expressed as flat properties rather than a list of field objects. Two is what
 * the design calls for; a third would mean three more properties, at which point
 * parallel arrays would be worth the trade.
 *
 * The rendered panel collects nothing — see components/blocks/QuoteForm.tsx for
 * why that matters when one of the fields is a personal number.
 *
 * NO heading/intro properties here on purpose. They were added and immediately
 * reverted: adding a property to a REGISTERED content type breaks every page in
 * the site until Graph's schema catches up, because the SDK puts the new field
 * in the composition fragment it sends for every request. Graph had not picked
 * them up nine minutes later and the whole site was returning 500.
 *
 * Display SETTINGS do not have this problem — they live in the composition, not
 * in Graph's type schema — which is why the hero's spacing is solved with a
 * setting on OT_PrimaryTextDefault instead.
 */
export const OT_QuoteForm = contentType({
  key: 'OT_QuoteForm',
  displayName: 'Quote Form',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled', 'sectionEnabled'],
  properties: {
    checkItems: {
      type: 'array', displayName: 'Tick list', isLocalized: true,
      description: 'One selling point per row, shown above the panel with a tick.',
      group: 'OT_Content', sortOrder: 10, items: { type: 'string' },
    },
    field1Label:       { type: 'string', displayName: 'Field 1 — label',        isLocalized: true, maxLength: 60,  group: 'OT_Content', sortOrder: 20 },
    field1Placeholder: { type: 'string', displayName: 'Field 1 — placeholder',  isLocalized: true, maxLength: 60,  group: 'OT_Content', sortOrder: 30 },
    field1LinkLabel:   { type: 'string', displayName: 'Field 1 — link text',    isLocalized: true, maxLength: 80,  group: 'OT_Content', sortOrder: 40 },
    field1LinkUrl:     { type: 'url',    displayName: 'Field 1 — link URL',                                        group: 'OT_Content', sortOrder: 50 },
    field2Label:       { type: 'string', displayName: 'Field 2 — label',        isLocalized: true, maxLength: 60,  group: 'OT_Content', sortOrder: 60 },
    field2Placeholder: { type: 'string', displayName: 'Field 2 — placeholder',  isLocalized: true, maxLength: 60,  group: 'OT_Content', sortOrder: 70 },
    field2Help:        { type: 'string', displayName: 'Field 2 — help text',    isLocalized: true, maxLength: 160, group: 'OT_Content', sortOrder: 80 },
    ctaLabel:          { type: 'string', displayName: 'Button label',           isLocalized: true, maxLength: 40,  group: 'OT_Content', sortOrder: 90 },
    ctaUrl:            { type: 'url',    displayName: 'Button URL',                                                group: 'OT_Content', sortOrder: 100 },
  },
})
