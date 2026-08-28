import { contentType } from '@optimizely/cms-sdk'
import { OT_PractitionerProfile } from './OT_PractitionerProfile'

// ─── OT_PractitionerPage ──────────────────────────────────────────────────────
// A Visual Builder experience page for an individual practitioner. It references
// an OT_PractitionerProfile record, and the slug route (app/(site)/[...slug])
// uses that reference to render a locked PractitionerHeader OUTSIDE the
// composition tree — editors can never move or delete it, and it always reflects
// the latest data from the referenced record. Everything below the header is
// open Visual Builder composition.
//
// As an `_experience` it carries no compositionBehaviors, no adapter, and no
// display template — it is routed and rendered directly by the slug route.
// SEO fields are copied from BlankExperience / OT_BlogPage so lib/metadata.ts
// and lib/structured-data.ts share one code path; schemaType defaults to Person.

export const OT_PractitionerPage = contentType({
  key:         'OT_PractitionerPage',
  displayName: 'Practitioner Page',
  description: 'An individual practitioner profile page. References a Practitioner Profile to populate a locked header, then opens to free Visual Builder composition below.',
  baseType:    '_experience',
  mayContainTypes: ['*'], // All child content types allowed
  properties: {
    // ── Content ─────────────────────────────────────────────────────────────
    practitionerRef: {
      type:         'contentReference',
      allowedTypes: [OT_PractitionerProfile],
      displayName:  'Practitioner',
      description:  'The practitioner whose data populates the locked profile header. Required.',
      group:        'OT_Content',
      sortOrder:    10,
    },
    profileLabel: {
      type:        'string',
      isLocalized: true,
      maxLength:   60,
      displayName: 'Profile Label',
      description: 'Short contextual status badge shown in the header — "Accepting New Patients", "Bestselling Author", "Board Certified", "Award-Winning Litigator". Optional; leaves no gap when blank.',
      group:       'OT_Content',
      sortOrder:   20,
    },

    // ── SEO / Search & Discovery ──────────────────────────────────────────────
    // Identical field keys to BlankExperience / OT_BlogPage / OT_EventPage so
    // lib/metadata.ts and lib/structured-data.ts have a single code path.
    seoTitle: {
      type:         'string',
      displayName:  'Page Title',
      description:  'Appears in the browser tab and search results. Recommended 50–60 characters. Falls back to the practitioner’s name + primary area when blank.',
      group:        'OT_SEO',
      sortOrder:    10,
      indexingType: 'searchable',
    },
    seoDescription: {
      type:         'string',
      displayName:  'Meta Description',
      description:  'Appears in search engine result snippets. Recommended 120–160 characters. Falls back to the site-level Default Meta Description.',
      group:        'OT_SEO',
      sortOrder:    20,
      indexingType: 'searchable',
    },
    canonicalUrl: {
      type:        'url',
      displayName: 'Canonical URL',
      description: "Override only. Leave blank to use the page's own URL.",
      group:       'OT_SEO',
      sortOrder:   30,
    },
    ogImage: {
      type:         'contentReference',
      displayName:  'Social Share Image',
      description:  'Image shown when this page is shared on social platforms. Recommended 1200×630px. Falls back to the practitioner’s headshot, then the site default.',
      allowedTypes: ['_image'],
      group:        'OT_SEO',
      sortOrder:    40,
    },
    pageAnswer: {
      type:         'string',
      displayName:  'AI Answer Summary',
      description:  'A 1–3 sentence plain-language summary of who this person is and what they do. Used in structured data and as a direct signal to AI answer engines. Write plainly — no marketing language.',
      group:        'OT_SEO',
      sortOrder:    50,
      indexingType: 'searchable',
    },
    schemaType: {
      type:        'string',
      format:      'selectOne',
      displayName: 'Schema Type',
      description: 'The structured data type for this page. Controls which JSON-LD block is generated. Defaults to Person when left as None.',
      enum: [
        { value: 'none',    displayName: 'None (defaults to Person)' },
        { value: 'Person',  displayName: 'Person' },
        { value: 'WebPage', displayName: 'Web Page' },
        { value: 'Article', displayName: 'Article' },
        { value: 'FAQPage', displayName: 'FAQ Page' },
        { value: 'Product', displayName: 'Product' },
      ],
      group:       'OT_SEO',
      sortOrder:   60,
    },
    noIndex: {
      type:        'boolean',
      displayName: 'Hide from Search Engines',
      description: 'When enabled, adds noindex/nofollow robots directives and excludes this page from the sitemap.',
      group:       'OT_SEO',
      sortOrder:   70,
    },
    customSchemaJson: {
      type:        'string',
      displayName: 'Custom Schema JSON (Advanced)',
      description: 'Developer escape hatch. Paste a valid JSON-LD object here to override or extend the generated structured data. Must be valid JSON. Merged with the generated schema — do not include @context.',
      group:       'OT_SEO',
      sortOrder:    80,
    },
  },
})
