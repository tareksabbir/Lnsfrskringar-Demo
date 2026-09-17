import { contentType } from '@optimizely/cms-sdk'

/**
 * OT_MortgageCalculatorBlock — the "How much can I borrow?" affordability
 * calculator, modelled on Länsförsäkringar's own bolånekalkyl.
 *
 * What the editor controls here is the *starting* calculation: the price, down
 * payment, interest rate and incomes the block loads with. Those numbers are
 * what a visitor sees before touching anything, so they are the block's sample
 * calculation and belong in the CMS rather than in the code.
 *
 * Which sections appear — Income, Household, Other expenses — is controlled by
 * the three "Hide …" switches below, so the same block can be a full
 * affordability check on a mortgage page and a bare cost estimator elsewhere.
 * Hiding a section drops its questions from the calculation as well as from the
 * page, so the figures on screen always match the questions that were asked.
 *
 * The defaults in the component reproduce Länsförsäkringar's published example:
 * 4 250 000 kr at 2.71% with 425 000 kr down comes out at 17 386 kr/month.
 */
export const OT_MortgageCalculatorBlock = contentType({
  key:                  'OT_MortgageCalculatorBlock',
  displayName:          'Mortgage Calculator Block',
  description:          'Interactive mortgage affordability calculator with a live cost panel. The Income, Household and Other expenses sections can each be hidden on the block.',
  baseType:             '_component',
  compositionBehaviors: ['elementEnabled', 'sectionEnabled'],
  properties: {
    heading: {
      type:         'string',
      isLocalized:  true,
      maxLength:    120,
      displayName:  'Heading',
      description:  'Defaults to "How much can I borrow?" when left empty.',
      group:        'OT_Content',
      sortOrder:    5,
      indexingType: 'searchable',
    },
    headingLevel: {
      type:        'string',
      format:      'selectOne',
      displayName: 'Heading Level',
      description: 'Set H1 when the calculator opens the page and nothing above it carries the title.',
      group:       'OT_Content',
      sortOrder:   7,
      enum: [
        { value: 'h2', displayName: 'H2 – Section heading (default)' },
        { value: 'h1', displayName: 'H1 – Page title' },
      ],
    },
    intro: {
      type:         'string',
      isLocalized:  true,
      maxLength:    300,
      displayName:  'Intro',
      description:  'One line under the heading, e.g. "Estimate how much you can borrow and what it will cost each month."',
      group:        'OT_Content',
      sortOrder:    10,
      indexingType: 'searchable',
    },
    purpose: {
      type:        'string',
      format:      'selectOne',
      displayName: 'Selected journey',
      description: 'Which of the four journeys is selected when the page loads. A visitor can switch.',
      group:       'OT_Content',
      sortOrder:   15,
      enum: [
        { value: 'purchase', displayName: 'Mortgage — a home they have found (default)' },
        { value: 'promise',  displayName: 'Mortgage promise — still looking' },
        { value: 'move',     displayName: 'Move a mortgage from another lender' },
        { value: 'increase', displayName: 'Increase a mortgage on a home they own' },
      ],
    },

    // ── Which sections the form asks about ───────────────────────────────────
    // Phrased as "hide" rather than "show" because an unset boolean reads as
    // false, and false has to mean "leave it alone". A `showIncome` field would
    // empty the form on every block that has never been saved with it.
    hideIncome: {
      type:        'boolean',
      displayName: 'Hide the Income section',
      description: 'Removes the questions about who is applying, employment and monthly income. With no income there is nothing to assess, so the "Will I get the loan?" verdict and the household budget go too, and the block becomes a monthly-cost estimator.',
      group:       'OT_Content',
      sortOrder:   16,
    },
    hideHousehold: {
      type:        'boolean',
      displayName: 'Hide the Household section',
      description: 'Removes the questions about other homes being kept and children under 20 at home. Their costs stop counting against what the household can afford.',
      group:       'OT_Content',
      sortOrder:   17,
    },
    hideOtherExpenses: {
      type:        'boolean',
      displayName: 'Hide the Other expenses section',
      description: 'Removes the questions about student loans, other loans and credit cards. Those repayments stop counting against what the household can afford.',
      group:       'OT_Content',
      sortOrder:   18,
    },

    // ── The sample calculation the block loads with ──────────────────────────
    price: {
      type:        'integer',
      displayName: 'Starting price (kr)',
      description: 'Purchase price the calculator opens with. Defaults to 4 250 000.',
      group:       'OT_Content',
      sortOrder:   20,
    },
    downPayment: {
      type:        'integer',
      displayName: 'Starting down payment (kr)',
      description: 'Defaults to 425 000, which is 10% of the starting price.',
      group:       'OT_Content',
      sortOrder:   25,
    },
    interestRate: {
      type:        'float',
      displayName: 'Starting interest rate (%)',
      description: 'Annual nominal rate the calculator opens with. Defaults to 2.71.',
      group:       'OT_Content',
      sortOrder:   30,
    },
    income1: {
      type:        'integer',
      displayName: 'Starting income, applicant 1 (kr/month)',
      description: 'Gross monthly income before tax. Defaults to 42 000. Only used when the Income section is on.',
      group:       'OT_Content',
      sortOrder:   35,
    },
    income2: {
      type:        'integer',
      displayName: 'Starting income, applicant 2 (kr/month)',
      description: 'Gross monthly income before tax. Defaults to 38 000.',
      group:       'OT_Content',
      sortOrder:   40,
    },

    // CTA: url + string label, never a `link` type — a localized link 500s the push.
    ctaLabel: {
      type:        'string',
      isLocalized: true,
      maxLength:   40,
      displayName: 'CTA Label',
      description: 'e.g. "Continue to application". The button is hidden when this is empty.',
      group:       'OT_Content',
      sortOrder:   45,
    },
    ctaUrl: {
      type:        'url',
      displayName: 'CTA URL',
      group:       'OT_Content',
      sortOrder:   50,
    },
    disclaimer: {
      type:        'string',
      isLocalized: true,
      maxLength:   300,
      displayName: 'Disclaimer',
      description: 'Small print under the form. The calculator is an estimate, not an offer — say so here.',
      group:       'OT_Content',
      sortOrder:   55,
    },
  },
})
