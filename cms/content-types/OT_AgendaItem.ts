import { contentType } from '@optimizely/cms-sdk'

// Sub-component of OT_EventPage. Exists only as an item inside the page's
// `agenda` array — never placed independently in a composition, so it has no
// compositionBehaviors. Must still be registered in initContentTypeRegistry
// so the SDK can build its GraphQL fragment.
export const OT_AgendaItem = contentType({
  key:         'OT_AgendaItem',
  displayName: 'Agenda Item',
  description: 'A single agenda entry: a time slot, session title, and optional speaker.',
  baseType:    '_component',
  properties: {
    time: {
      type:        'string',
      displayName: 'Time',
      description: 'e.g. "9:00 AM – 9:45 AM"',
      isLocalized: true,
      maxLength:   40,
      group:       'OT_Content',
      sortOrder:   10,
    },
    title: {
      type:        'string',
      displayName: 'Session Title',
      isLocalized: true,
      maxLength:   120,
      group:       'OT_Content',
      sortOrder:   20,
      indexingType: 'searchable',
    },
    description: {
      type:        'string',
      displayName: 'Session Description',
      isLocalized: true,
      maxLength:   200,
      group:       'OT_Content',
      sortOrder:   30,
    },
    speaker: {
      type:        'string',
      displayName: 'Speaker Name',
      isLocalized: true,
      maxLength:   80,
      group:       'OT_Content',
      sortOrder:   40,
    },
  },
})
