import { contentType } from '@optimizely/cms-sdk'

/* Image references stay narrowed to ['_image'] on purpose.
 *
 * Untyped (allowedTypes: []) looks tempting because it is the only shape the CMS
 * API accepts a DAM asset in — but it breaks the front end. The SDK's
 * resolveAllowedTypes does:
 *     const baseline = allowed?.length ? allowed : cached
 * so an empty list falls back to EVERY registered content type, and the
 * generated Graph query spreads a fragment for all ~70 of them. That returns
 * "HTTP 400: 9 errors in the GraphQL query" and the page fails to render.
 *
 * DAM assets reach the site through OT_ResourceLibraryBlock instead, which
 * queries cmp_Asset directly via Graph (see lib/resourceLibrary.ts). */

// Sub-component of OT_EventPage. Exists only as an item inside the page's
// `speakers` array — never placed independently in a composition, so it has
// no compositionBehaviors. Must still be registered in initContentTypeRegistry
// so the SDK can build its GraphQL fragment.
export const OT_EventSpeaker = contentType({
  key:         'OT_EventSpeaker',
  displayName: 'Event Speaker',
  description: 'A single speaker, presenter, or panelist for an event.',
  baseType:    '_component',
  properties: {
    name: {
      type:        'string',
      displayName: 'Name',
      isLocalized: true,
      maxLength:   80,
      group:       'OT_Content',
      sortOrder:   10,
      indexingType: 'searchable',
    },
    title: {
      type:        'string',
      displayName: 'Title',
      description: 'Professional role title.',
      isLocalized: true,
      maxLength:   100,
      group:       'OT_Content',
      sortOrder:   20,
    },
    organization: {
      type:        'string',
      displayName: 'Organization',
      description: 'Company, hospital, firm, or institution.',
      isLocalized: true,
      maxLength:   100,
      group:       'OT_Content',
      sortOrder:   30,
    },
    bio: {
      type:        'string',
      displayName: 'Short Bio',
      isLocalized: true,
      maxLength:   300,
      group:       'OT_Content',
      sortOrder:   40,
    },
    headshot: {
      type:         'contentReference',
      displayName:  'Headshot',
      allowedTypes: ['_image'],
      group:        'OT_Content',
      sortOrder:    50,
    },
    profileUrl: {
      type:        'url',
      displayName: 'Profile URL',
      isLocalized: true,
      group:       'OT_Content',
      sortOrder:   60,
    },
  },
})
