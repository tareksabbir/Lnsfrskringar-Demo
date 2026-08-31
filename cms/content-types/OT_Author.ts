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

/**
 * OT_Author — shared author profile content type.
 *
 * Author items are managed centrally (e.g. in a dedicated /Authors folder)
 * and referenced from blog posts via a contentReference field. This keeps
 * author data canonical: one update propagates to all posts.
 *
 * Fields intentionally NOT localized:
 *  - name:     a person's name is the same across languages
 *  - photo:    one profile image shared across locales
 *  - linkedIn, twitter: external URLs not locale-specific
 *
 * Fields that ARE localized:
 *  - role:  job title may differ across language contexts
 *  - bio:   editorial biography should be authored per locale
 */
export const OT_Author = contentType({
  key: 'OT_Author',
  displayName: 'Author',
  description: 'Author profile with name, bio, photo, and social links.',
  baseType: '_component',
  // elementEnabled — allows this block to be added to VB experiences, which is what
  // enables the CMS preview pane when editing a shared Author item.
  compositionBehaviors: ['elementEnabled'],
  properties: {
    name: {
      type: 'string',
      isLocalized: false,
      maxLength: 80,
      displayName: 'Full Name',
      group: 'OT_Content',
      sortOrder: 10,
      indexingType: 'searchable',
    },
    role: {
      type: 'string',
      isLocalized: true,
      maxLength: 100,
      displayName: 'Role / Title',
      group: 'OT_Content',
      sortOrder: 20,
      indexingType: 'searchable',
    },
    bio: {
      type: 'richText',
      isLocalized: true,
      displayName: 'Bio',
      group: 'OT_Content',
      sortOrder: 30,
      indexingType: 'searchable',
    },
    photo: {
      type: 'contentReference',
      allowedTypes: ['_image'],
      displayName: 'Profile Photo',
      group: 'OT_Content',
      sortOrder: 40,
    },
    linkedIn: {
      type: 'url',
      isLocalized: false,
      displayName: 'LinkedIn URL',
      group: 'OT_Content',
      sortOrder: 50,
    },
    twitter: {
      type: 'url',
      isLocalized: false,
      displayName: 'Twitter / X URL',
      group: 'OT_Content',
      sortOrder: 60,
    },
  },
})
