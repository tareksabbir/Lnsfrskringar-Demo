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

export const OT_HeroBlock = contentType({
  key: 'OT_HeroBlock',
  displayName: 'Hero Block',
  description: 'Full-width hero with eyebrow, headline, body, and dual CTAs.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled', 'sectionEnabled'],
  properties: {
    direction: {
      type:        'string',
      format:      'selectOne',
      displayName: 'Design Direction',
      description: 'The hero art direction / composition. "Editorial Split" is the classic text-beside-image layout; the others restyle the same content. Background color still applies within each.',
      enum: [
        { value: 'editorialSplit', displayName: 'Editorial Split (Default)' },
        { value: 'spotlight',      displayName: 'Spotlight Bloom' },
        { value: 'overlap',        displayName: 'Editorial Overlap' },
        { value: 'diagonal',       displayName: 'Diagonal Split' },
      ],
      group:     'OT_Content',
      sortOrder: 5,
    },
    eyebrow:            { type: 'string', isLocalized: true, maxLength: 60,  displayName: 'Eyebrow',             group: 'OT_Content', sortOrder: 10, indexingType: 'searchable' },
    headline:           { type: 'string', isLocalized: true, maxLength: 120, displayName: 'Headline',            group: 'OT_Content', sortOrder: 20, indexingType: 'searchable' },
    body:               { type: 'string', isLocalized: true, maxLength: 300, displayName: 'Body',                group: 'OT_Content', sortOrder: 30, indexingType: 'searchable' },
    primaryCtaLabel:    { type: 'string', isLocalized: true, maxLength: 40,  displayName: 'Primary CTA Label',   group: 'OT_Content', sortOrder: 40 },
    primaryCtaUrl:      { type: 'url',                                       displayName: 'Primary CTA URL',     group: 'OT_Content', sortOrder: 50 },
    secondaryCtaLabel:  { type: 'string', isLocalized: true, maxLength: 40,  displayName: 'Secondary CTA Label', group: 'OT_Content', sortOrder: 60 },
    secondaryCtaUrl:    { type: 'url',                                       displayName: 'Secondary CTA URL',   group: 'OT_Content', sortOrder: 70 },
    visual:             { type: 'contentReference', allowedTypes: ['_image'], displayName: 'Visual Image',    group: 'OT_Content', sortOrder: 80 },
    visualAlt:          { type: 'string', isLocalized: true,  maxLength: 200, displayName: 'Visual Alt Text', group: 'OT_Content', sortOrder: 90 },
  },
})
