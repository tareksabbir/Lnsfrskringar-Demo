import { contentType } from '@optimizely/cms-sdk'

// ─── OT_PracticeArea ──────────────────────────────────────────────────────────
// Pure sub-component. Lives only inside OT_PractitionerProfile's `practiceAreas`
// array — never placed independently, so no compositionBehaviors. Localization
// is handled field-by-field here (the parent array is not marked localized),
// mirroring OT_EventSpeaker / OT_AgendaItem.
//
// One "area" is a specialty or discipline: Oncology / Tax Law / Computer Science.
// `isPrimary` drives display priority — the primary area is the one surfaced in
// the profile header, card, and list row.

export const OT_PracticeArea = contentType({
  key:         'OT_PracticeArea',
  displayName: 'Practice Area',
  description: 'A specialty or discipline for a practitioner (e.g. Oncology, Tax Law). Used inside a Practitioner Profile.',
  baseType:    '_component',
  properties: {
    areaName: {
      type:         'string',
      isLocalized:  true,
      maxLength:    80,
      displayName:  'Area Name',
      description:  'The specialty or discipline name — "Oncology", "Tax Law", "Computer Science".',
      group:        'OT_Content',
      sortOrder:    10,
      indexingType: 'searchable',
    },
    facility: {
      type:        'string',
      isLocalized: true,
      maxLength:   120,
      displayName: 'Facility / Office',
      description: 'Associated location, office, or division — "Memorial Cancer Center", "Chicago Office". Optional.',
      group:       'OT_Content',
      sortOrder:   20,
    },
    isPrimary: {
      type:        'boolean',
      displayName: 'Primary Area',
      description: 'Marks the primary practice area. Drives display priority on cards and the profile header. Set this on exactly one area.',
      group:       'OT_Content',
      sortOrder:   30,
    },
  },
})
