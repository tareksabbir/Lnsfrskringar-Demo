import { contentType } from '@optimizely/cms-sdk'

/**
 * A contact form that actually sends.
 *
 * ── Why this is not Optimizely Forms ────────────────────────────────────────
 * This instance does not have the Forms add-on. The twelve OptiForms* types in
 * this repo are registered behind NEXT_PUBLIC_OPTIFORMS_ENABLED and deliberately
 * never pushed: they exist in the SDK registry and not in Graph, so turning that
 * flag on makes every page query fail with "HTTP 400: 9 errors in the GraphQL
 * query". Confirmed against this instance — of 85 content types and the whole
 * Graph schema, nothing Forms-related exists.
 *
 * So the form is ours. It posts to /api/contact.
 *
 * ── Why the fields are labels, not a field builder ──────────────────────────
 * An editor changes what the form SAYS, not what it collects. The four inputs
 * are fixed in the component, which means the endpoint knows exactly what
 * arrives and can validate it, and no editor can add a field that quietly
 * starts collecting a personal number or a card number into a store that was
 * never designed to hold one. That is the trade this makes deliberately: less
 * flexible than Optimizely Forms, and much harder to misuse.
 */
export const OT_ContactForm = contentType({
  key: 'OT_ContactForm',
  displayName: 'Contact Form',
  description:
    'A working contact form. Submissions POST to /api/contact and are held for '
    + 'review in Opti-Admin — never emailed, never written into the content tree.',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled', 'sectionEnabled'],
  properties: {
    heading:        { type: 'string', isLocalized: true, maxLength: 120, displayName: 'Heading',              group: 'OT_Content', sortOrder: 10 },
    intro:          { type: 'string', isLocalized: true, maxLength: 400, displayName: 'Intro',                group: 'OT_Content', sortOrder: 20 },
    nameLabel:      { type: 'string', isLocalized: true, maxLength: 60,  displayName: 'Name field label',     group: 'OT_Content', sortOrder: 30 },
    emailLabel:     { type: 'string', isLocalized: true, maxLength: 60,  displayName: 'Email field label',    group: 'OT_Content', sortOrder: 40 },
    subjectLabel:   { type: 'string', isLocalized: true, maxLength: 60,  displayName: 'Subject field label',  group: 'OT_Content', sortOrder: 50 },
    messageLabel:   { type: 'string', isLocalized: true, maxLength: 60,  displayName: 'Message field label',  group: 'OT_Content', sortOrder: 60 },
    consentText:    {
      type: 'string', isLocalized: true, maxLength: 300, displayName: 'Consent text',
      description: 'Shown beside the checkbox the sender must tick before the form will send.',
      group: 'OT_Content', sortOrder: 70,
    },
    submitLabel:    { type: 'string', isLocalized: true, maxLength: 40,  displayName: 'Submit button label',  group: 'OT_Content', sortOrder: 80 },
    successMessage: { type: 'string', isLocalized: true, maxLength: 300, displayName: 'Message shown after sending', group: 'OT_Content', sortOrder: 90 },
  },
})
