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

export const OT_ImageBlock = contentType({
  key: 'OT_ImageBlock',
  displayName: 'Image Block',
  description: 'Single image with optional editorial context (eyebrow, heading, body, CTA). Populating any editorial field auto-enables a 2-column layout with configurable media side.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled', 'sectionEnabled'],
  properties: {
    mediaSide: {
      type: 'string',
      format: 'selectOne',
      displayName: 'Media Side',
      description: 'Which side the media sits on in the editorial layout.',
      enum: [
        { value: 'right', displayName: 'Media right (Default)' },
        { value: 'left', displayName: 'Media left' },
      ],
      group: 'OT_Content',
      sortOrder: 5,
    },
    image:   { type: 'contentReference', allowedTypes: ['_image'], displayName: 'Image', group: 'OT_Content', sortOrder: 10 },
    alt:     { type: 'string', isLocalized: true, maxLength: 200, displayName: 'Alt Text',  group: 'OT_Content', sortOrder: 20 },
    caption: { type: 'string', isLocalized: true, maxLength: 200, displayName: 'Caption',   group: 'OT_Content', sortOrder: 30 },
    eyebrow: { type: 'string', isLocalized: true, maxLength: 80,  displayName: 'Eyebrow',   group: 'OT_Content', sortOrder: 35 },
    heading: { type: 'string', isLocalized: true, maxLength: 120, displayName: 'Heading',   group: 'OT_Content', sortOrder: 40 },
    body:     { type: 'richText', isLocalized: true,               displayName: 'Body',      group: 'OT_Content', sortOrder: 50 },
    ctaLabel: { type: 'string', isLocalized: true, maxLength: 60, displayName: 'CTA Label', group: 'OT_Content', sortOrder: 60 },
    ctaUrl:   { type: 'url',                                      displayName: 'CTA URL',   group: 'OT_Content', sortOrder: 70 },
  },
})
