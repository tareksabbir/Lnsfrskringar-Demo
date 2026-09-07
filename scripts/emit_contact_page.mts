/**
 * Emits the Contact us composition. Posted by a script, not from here — the
 * same split as scripts/emit_section_probe.mts, so the builder that runs is
 * the real one.
 *
 *   npx tsx scripts/emit_contact_page.mts > /tmp/contact.json
 */

const component = (contentType: string, template: string,
                   settings: Record<string, string>,
                   properties: Record<string, unknown>) => ({
  nodeType: 'component',
  displaySettings: { displayTemplate: template, settings },
  component: { contentType, properties },
})

const column = (nodes: unknown[], span = 'col12') => ({
  nodeType: 'column',
  displaySettings: { displayTemplate: 'OT_LandingColumn',
    settings: { gridSpan: span, contentSpacing: 'small', verticalPadding: 'none' } },
  nodes,
})

const row = (columns: unknown[]) => ({
  nodeType: 'row',
  displaySettings: { displayTemplate: 'OT_LandingRow',
    settings: { showAsRowFrom: 'lg', contentSpacing: 'medium', verticalPadding: 'small', entranceAnimation: 'fade' } },
  nodes: columns,
})

const section = (rows: unknown[], name: string, bg = 'canvas') => ({
  nodeType: 'section',
  layoutType: 'grid',
  displayName: name,
  displaySettings: { displayTemplate: 'OT_LandingSection',
    settings: { gridWidth: 'narrow', verticalSpacing: 'medium', backgroundColor: bg,
                sectionOverlap: 'none', entranceAnimation: 'none' } },
  component: { contentType: 'BlankSection', properties: {} },
  nodes: rows,
})

const composition = {
  nodeType: 'experience',
  layoutType: 'outline',
  nodes: [
    section([row([column([
      component('OT_PrimaryTextBlock', 'OT_PrimaryTextDefault',
        { alignment: 'left', color: 'none', size: 'display', spacing: 'small', entranceAnimation: 'none' },
        {
          headline: { value: 'Contact us' },
          headingLevel: { value: 'h1' },
          headerEffect: { value: 'none' },
          body: { value: { html: '<p>Questions about your insurance, a claim, or your account? Send us a message and we will come back to you within two working days.</p>' } },
        }),
    ])])], 'Title'),

    section([row([column([
      component('OT_ContactForm', 'OT_ContactFormDefault',
        { color: 'surface', layout: 'compact' },
        {
          heading:        { value: 'Send us a message' },
          intro:          { value: 'Fields marked with a label are required. We use your details only to answer this enquiry.' },
          nameLabel:      { value: 'Your name' },
          emailLabel:     { value: 'Email address' },
          subjectLabel:   { value: 'Subject' },
          messageLabel:   { value: 'How can we help?' },
          consentText:    { value: 'I agree that Länsförsäkringar Stockholm may use my details to answer this enquiry.' },
          submitLabel:    { value: 'Send message' },
          successMessage: { value: 'Thank you — your message has been received. We will be in touch within two working days.' },
        }),
    ])])], 'Contact form', 'canvas'),

    section([row([column([
      component('OT_CalloutBlock', 'OT_CalloutDefault',
        { variant: 'filled', size: 'default', alignment: 'left', dismissible: 'off',
          sticky: 'off', icon: 'none', entranceAnimation: 'none', maxWidth: 'full' },
        {
          intent:  { value: 'warning' },
          heading: { value: 'In an emergency, call us' },
          body:    { value: 'Do not use this form to report an ongoing emergency or an accident in progress. Call 020-88 00 00, around the clock.' },
        }),
    ])])], 'Emergency notice'),

    section([row([column([
      component('OT_RichTextBlock', 'OT_RichTextDefault',
        { color: 'none', alignment: 'left', size: 'editorial', treatment: 'standard' },
        { content: { value: { html:
          '<h2>Other ways to reach us</h2>'
          + '<ul>'
          + '<li>Customer service: 020-88 00 00, weekdays 08:00–18:00</li>'
          + '<li>Claims: report a claim in your online account</li>'
          + '<li>Visit us: Tegeluddsvägen 21, 115 41 Stockholm</li>'
          + '</ul>' } } }),
    ])])], 'Other ways to reach us'),
  ],
}

process.stdout.write(JSON.stringify({
  displayName: 'Contact us',
  routeSegment: 'contact',
  composition,
}))
