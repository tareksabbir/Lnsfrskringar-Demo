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
 * OT_LogoItem — a single partner or customer logo within OT_TrustRail.
 * Not a standalone block; only appears as an array item inside OT_TrustRail.
 *
 * Editors upload the logo image, provide an accessible company name via
 * altText, and optionally link the logo to an external URL.
 *
 * IMAGE FORMAT: SVG is strongly preferred. The component applies grayscale,
 * opacity, and brightness/invert CSS filters depending on the treatment setting
 * (mono/color/brand). These filters produce perfectly sharp results on SVG;
 * raster images may show filter artifacts at small sizes or on retina displays.
 * A transparent background is REQUIRED — the brand treatment uses
 * brightness(0) invert(1) to force logos white; an opaque background will
 * produce a white box instead of a white logo shape.
 *
 * Accepted formats in order of preference: SVG → transparent PNG → transparent WebP
 * Avoid: JPG, opaque PNG (the background will be visible through the filter)
 */
export const OT_LogoItem = contentType({
  key:         'OT_LogoItem',
  displayName: 'Logo Item',
  baseType:    '_component',
  properties: {
    image: {
      type:         'contentReference',
      allowedTypes: ['_image'],
      displayName:  'Logo Image',
      description:  'SVG strongly preferred. Must have transparent background — the mono and brand treatments apply CSS filters that will expose any solid background color. Transparent PNG is an acceptable fallback.',
      group:        'OT_Content',
      sortOrder:    10,
      isRequired:   true,
    },
    altText: {
      type:        'string',
      maxLength:   120,
      displayName: 'Company Name',
      description: 'Accessible label — the company or brand name. e.g. "Acme Corp"',
      group:       'OT_Content',
      sortOrder:   20,
    },
    url: {
      type:        'url',
      displayName: 'Link URL',
      description: 'Optional. Makes the logo a clickable link to the partner site.',
      group:       'OT_Content',
      sortOrder:   30,
    },
  },
})
