import { contentType } from '@optimizely/cms-sdk'

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
