'use client'

/**
 * MortgageCalculatorBlock — "How much can I borrow?"
 *
 * A working affordability calculator modelled on Länsförsäkringar's own
 * bolånekalkyl: a form on the left in four sections, a panel on the right that
 * recalculates as you type, and a gauge that answers whether the loan is within
 * what the household's income supports.
 *
 * Three of the four sections are switchable — Income, Household and Other
 * expenses, each with a Hide field on the CMS block. Turning one off does not
 * merely hide its fields: `input` below is assembled from visible sections only, so a
 * hidden question can never quietly move the monthly figure. Switch Income off
 * and the block degrades honestly, from an affordability check into a cost
 * estimator, and the gauge says it has nothing to go on.
 *
 * The arithmetic lives in `mortgage/model.ts`, the controls in
 * `mortgage/controls.tsx`. This file is state and layout.
 *
 * Nothing is submitted anywhere. There is no <form>, the inputs carry no
 * `name`, and the CTA is a link into a real application journey — a calculator
 * that quietly posted a household's income to an endpoint would be a
 * considerably bigger decision than a block.
 */

import { useMemo, useState } from 'react'
import * as RadixAccordion from '@radix-ui/react-accordion'
import {
  Building2, ChevronDown, FileCheck2, Home, Percent,
  PlusCircle, Repeat, Tent, Wallet,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Button from '@/components/ui/Button'
import {
  calculate, formatKr, formatPercent, MORTGAGE_CAP_LTV,
  EMPLOYMENT_TYPES, MUNICIPALITIES,
  type CalculatorInput, type Purpose, type PropertyKind,
} from './mortgage/model'
import {
  ChoiceCards, Field, FieldSet, Gauge, MoneyInput, Scallop,
  SectionCard, Segmented, SelectField, YesNo,
} from './mortgage/controls'

// ── Public shape ──────────────────────────────────────────────────────────────

export type MortgageCalculatorStyleOptions = {
  color?:             'canvas' | 'surface'
  showIncome?:        boolean
  showHousehold?:     boolean
  showOtherExpenses?: boolean
  /** Whether the result panel follows the reader down the form on desktop. */
  stickyPanel?:       boolean
}

type EpiField = 'heading' | 'intro' | 'ctaLabel' | 'disclaimer'

export type MortgageCalculatorBlockProps = {
  heading?: string
  /** H1 when the calculator opens the page, H2 when something above it does. */
  headingLevel?: 'h1' | 'h2'
  intro?:   string
  /** Which of the four journeys is selected when the page loads. */
  purpose?: Purpose
  /** Starting values — the "sample calculation" an editor controls in the CMS. */
  price?:        number
  downPayment?:  number
  interestRate?: number
  income1?:      number
  income2?:      number
  ctaLabel?:   string
  ctaUrl?:     string
  disclaimer?: string
  styleOptions?: MortgageCalculatorStyleOptions
  /** Precomputed data-epi-edit attributes. Empty outside the CMS editor. */
  epi?: Partial<Record<EpiField, Record<string, string | undefined>>>
}

// ── The four journeys, and what each one calls the two big numbers ────────────

const PURPOSES: { value: Purpose; label: string; icon: React.ReactNode; note: string }[] = [
  {
    value: 'promise',
    label: 'Mortgage promise',
    icon:  <FileCheck2 />,
    note:  'For when you are still looking. A mortgage promise tells you your budget before you bid.',
  },
  {
    value: 'purchase',
    label: 'Mortgage',
    icon:  <Home />,
    note:  'For when you have already found a home you want to buy.',
  },
  {
    value: 'move',
    label: 'Move a mortgage',
    icon:  <Repeat />,
    note:  'For moving an existing mortgage to us. Your loan stays the same size — only the terms change.',
  },
  {
    value: 'increase',
    label: 'Increase a mortgage',
    icon:  <PlusCircle />,
    note:  'For borrowing more against a home you already own, for a renovation or an extension.',
  },
]

const PROPERTY_KINDS: { value: PropertyKind; label: string; icon: React.ReactNode }[] = [
  { value: 'house',     label: 'House',       icon: <Home /> },
  { value: 'apartment', label: 'Apartment',   icon: <Building2 /> },
  { value: 'holiday',   label: 'Holiday home', icon: <Tent /> },
]

/** `move` and `increase` are about a home already owned, so the labels change. */
const isRefinance = (purpose: Purpose) => purpose === 'move' || purpose === 'increase'

const RUNNING_COST_LABEL: Record<PropertyKind, string> = {
  house:     'Running costs, house',
  apartment: 'Monthly fee and running costs',
  holiday:   'Running costs, holiday home',
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function MortgageCalculatorBlock({
  heading      = 'How much can I borrow?',
  headingLevel = 'h2',
  intro,
  purpose: initialPurpose = 'purchase',
  price:        initialPrice = 4_250_000,
  downPayment:  initialDownPayment = 425_000,
  interestRate: initialRate = 2.71,
  income1:      initialIncome1 = 42_000,
  income2:      initialIncome2 = 38_000,
  ctaLabel,
  ctaUrl,
  disclaimer,
  styleOptions = {},
  epi = {},
}: MortgageCalculatorBlockProps) {
  const {
    color             = 'surface',
    showIncome        = true,
    showHousehold     = true,
    showOtherExpenses = true,
    stickyPanel       = true,
  } = styleOptions

  const [purpose,        setPurpose]        = useState<Purpose>(initialPurpose)
  const [propertyKind,   setPropertyKind]   = useState<PropertyKind>('house')
  const [price,          setPrice]          = useState(initialPrice)
  const [downPayment,    setDownPayment]    = useState(initialDownPayment)
  const [extraBorrowing, setExtraBorrowing] = useState(300_000)
  const [municipality,   setMunicipality]   = useState<string>('Stockholm')
  // The rate keeps a text twin, so a half-typed "2." survives long enough to
  // become "2.7". Parsing straight back into the number would erase the dot.
  const [rate,           setRate]           = useState(initialRate)
  const [rateText,       setRateText]       = useState(String(initialRate))

  const [applicants,   setApplicants]   = useState<'one' | 'two'>('two')
  const [employment,   setEmployment]   = useState<string>('Permanent employment')
  const [income1,      setIncome1]      = useState(initialIncome1)
  const [income2,      setIncome2]      = useState(initialIncome2)
  const [foreignPay,   setForeignPay]   = useState(false)
  const [sharesOther,  setSharesOther]  = useState(false)
  const [sharedCost,   setSharedCost]   = useState(4_000)

  const [keepsProperty,  setKeepsProperty]  = useState(false)
  const [keptCost,       setKeptCost]       = useState(3_500)
  const [hasChildren,    setHasChildren]    = useState(false)
  const [children,       setChildren]       = useState(2)

  const [hasStudentLoan, setHasStudentLoan] = useState(false)
  const [studentLoan,    setStudentLoan]    = useState(1_500)
  const [hasOtherLoans,  setHasOtherLoans]  = useState(false)
  const [otherLoans,     setOtherLoans]     = useState(2_500)

  // Only what the reader can actually see feeds the result. A question inside a
  // section the editor switched off contributes nothing.
  const input: CalculatorInput = useMemo(() => ({
    purpose,
    propertyKind,
    price,
    downPayment,
    extraBorrowing,
    interestRate: rate,
    applicants: showIncome && applicants === 'two' ? 2 : 1,
    incomes: showIncome
      ? [income1, applicants === 'two' ? income2 : 0]
      : [0, 0],
    childrenUnder20:  showHousehold && hasChildren ? children : 0,
    otherHousingCost:
      (showIncome && sharesOther ? sharedCost : 0) +
      (showHousehold && keepsProperty ? keptCost : 0),
    studentLoanCost:  showOtherExpenses && hasStudentLoan ? studentLoan : 0,
    otherLoanCost:    showOtherExpenses && hasOtherLoans ? otherLoans : 0,
  }), [
    purpose, propertyKind, price, downPayment, extraBorrowing, rate,
    showIncome, applicants, income1, income2, sharesOther, sharedCost,
    showHousehold, hasChildren, children, keepsProperty, keptCost,
    showOtherExpenses, hasStudentLoan, studentLoan, hasOtherLoans, otherLoans,
  ])

  const result = useMemo(() => calculate(input), [input])

  const downPaymentShare = price > 0 ? downPayment / price : 0
  const activePurpose    = PURPOSES.find(p => p.value === purpose) ?? PURPOSES[1]
  const Heading          = headingLevel

  return (
    <section
      className={cn(
        'w-full px-md py-xl lg:px-lg',
        color === 'canvas' ? 'bg-canvas' : 'bg-surface',
      )}
      data-surface="light"
      // A block-scoped shift of the anchor, cooler and a shade more saturated
      // than the site's navy, so this calculator reads as its own instrument
      // rather than more page furniture — and so the Stockholm and Skåne demos
      // are visibly distinct when shown side by side.
      //
      // Scoped deliberately, NOT set in styles/tokens.css: #00427a is
      // Länsförsäkringar's actual brand colour, and re-tinting the whole site to
      // differentiate one block would be the wrong trade.
      //
      // Overriding these two is sufficient *for this block*, but not for the
      // general case, and the difference is worth knowing before adding to it.
      // `text-brand` / `bg-brand` / `border-brand` compile to
      // `var(--ot-brand)` directly (globals.css uses `@theme inline`), so they
      // resolve against whatever is in scope and follow this override — as does
      // `accent-[var(--ot-brand)]` on the sliders. The *derived* tokens do not:
      // `--ot-brand-tint` and the four `--ot-bloom-brand-*` are declared on
      // `:root` as `oklch(from var(--ot-brand) …)`, and a custom property is
      // substituted where it is declared, so they were already resolved against
      // the site anchor and merely inherit down here. This block uses none of
      // them, which is why two lines are enough. Reach for a tint or a bloom
      // inside this block and it will silently paint in the site's hue while
      // everything around it paints in this one — redeclare it here too.
      //
      // Lightness is held near the site anchor's 38% on purpose: the hue moves,
      // the contrast does not, so every AA ratio the original cleared still
      // clears here.
      style={{
        ['--ot-brand' as string]:       'oklch(40% 0.125 240)',
        ['--ot-brand-hover' as string]: 'oklch(29% 0.105 240)',
      }}
    >
      <div className="mx-auto w-full max-w-[76rem]">
        {heading && (
          <Heading
            className="text-headline font-bold leading-headline tracking-headline text-brand"
            {...epi.heading}
          >
            {heading}
          </Heading>
        )}
        {intro && (
          <p className="mt-sm max-w-(--ot-measure) leading-body text-fg" {...epi.intro}>
            {intro}
          </p>
        )}

        <div className="mt-lg grid items-start gap-md lg:grid-cols-[minmax(0,1fr)_20rem]">
          {/* ── The form ───────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-md">
            <div className="bg-canvas p-md md:p-lg">
              <FieldSet legend="What would you like to calculate?">
                <ChoiceCards
                  name="ot-mortgage-purpose"
                  value={purpose}
                  onChange={setPurpose}
                  options={PURPOSES}
                  columns={4}
                />
              </FieldSet>
              <p className="mt-md bg-brand-tint px-sm py-2 text-label leading-body text-fg">
                {activePurpose.note}
              </p>
            </div>

            <SectionCard title={isRefinance(purpose) ? 'About your home' : 'About the home'}>
              <FieldSet legend="Type of home">
                <ChoiceCards
                  name="ot-mortgage-property"
                  value={propertyKind}
                  onChange={setPropertyKind}
                  options={PROPERTY_KINDS}
                />
              </FieldSet>

              <Field
                label={isRefinance(purpose) ? "The home's market value" : 'Purchase price'}
                htmlFor="ot-mortgage-price"
                help={
                  isRefinance(purpose)
                    ? 'Your best estimate of what the home would sell for today.'
                    : undefined
                }
              >
                <MoneyInput
                  id="ot-mortgage-price"
                  value={price}
                  onChange={setPrice}
                  min={500_000}
                  max={15_000_000}
                  step={50_000}
                  ariaLabel="Purchase price"
                />
              </Field>

              <Field
                label={
                  isRefinance(purpose)
                    ? 'Your existing mortgage'
                    : `Down payment (${formatPercent(downPaymentShare, 0)})`
                }
                htmlFor="ot-mortgage-down"
                help={
                  isRefinance(purpose)
                    ? 'What is left to pay on the mortgage you have today.'
                    : 'The down payment needs to be at least 10% of the final price.'
                }
              >
                <MoneyInput
                  id="ot-mortgage-down"
                  value={downPayment}
                  onChange={setDownPayment}
                  min={0}
                  max={price}
                  step={25_000}
                  ariaLabel={isRefinance(purpose) ? 'Existing mortgage' : 'Down payment'}
                />
              </Field>

              {purpose === 'increase' && (
                <Field
                  label="How much more do you want to borrow?"
                  htmlFor="ot-mortgage-extra"
                >
                  <MoneyInput
                    id="ot-mortgage-extra"
                    value={extraBorrowing}
                    onChange={setExtraBorrowing}
                    min={0}
                    max={3_000_000}
                    step={25_000}
                    ariaLabel="Additional borrowing"
                  />
                </Field>
              )}

              <Field
                label="Municipality"
                htmlFor="ot-mortgage-municipality"
                help="Looking in more than one? Pick the one you think you will buy in."
              >
                <SelectField
                  id="ot-mortgage-municipality"
                  value={municipality}
                  onChange={setMunicipality}
                  options={MUNICIPALITIES}
                />
              </Field>
            </SectionCard>

            {showIncome && (
              <SectionCard title="Income">
                <FieldSet legend="Number of applicants">
                  <Segmented
                    label="Number of applicants"
                    value={applicants}
                    onChange={setApplicants}
                    options={[
                      { value: 'one', label: 'One person' },
                      { value: 'two', label: 'Two people' },
                    ]}
                  />
                </FieldSet>

                <Field label="Employment" htmlFor="ot-mortgage-employment">
                  <SelectField
                    id="ot-mortgage-employment"
                    value={employment}
                    onChange={setEmployment}
                    options={EMPLOYMENT_TYPES}
                  />
                </Field>

                <Field
                  label={
                    applicants === 'two'
                      ? 'Monthly income before tax — applicant 1'
                      : 'Monthly income before tax'
                  }
                  htmlFor="ot-mortgage-income-1"
                  help="If your income varies, divide last year's income by 12."
                >
                  <MoneyInput
                    id="ot-mortgage-income-1"
                    value={income1}
                    onChange={setIncome1}
                    min={0}
                    max={150_000}
                    step={1_000}
                    ariaLabel="Monthly income before tax, applicant 1"
                  />
                </Field>

                {applicants === 'two' && (
                  <Field
                    label="Monthly income before tax — applicant 2"
                    htmlFor="ot-mortgage-income-2"
                  >
                    <MoneyInput
                      id="ot-mortgage-income-2"
                      value={income2}
                      onChange={setIncome2}
                      min={0}
                      max={150_000}
                      step={1_000}
                      ariaLabel="Monthly income before tax, applicant 2"
                    />
                  </Field>
                )}

                <FieldSet legend="Is any of the income paid in a foreign currency?">
                  <YesNo
                    name="Income in a foreign currency"
                    value={foreignPay}
                    onChange={setForeignPay}
                  />
                  {foreignPay && (
                    <p className="mt-xs text-label leading-body text-fg-muted">
                      We can still lend, but an adviser needs to look at the exchange-rate
                      risk with you before the offer is final.
                    </p>
                  )}
                </FieldSet>

                <FieldSet legend="Do you have housing costs for another home you share with someone?">
                  <YesNo
                    name="Housing costs for another home"
                    value={sharesOther}
                    onChange={setSharesOther}
                  />
                </FieldSet>

                {sharesOther && (
                  <Field label="Your share of that cost, per month" htmlFor="ot-mortgage-shared">
                    <MoneyInput
                      id="ot-mortgage-shared"
                      value={sharedCost}
                      onChange={setSharedCost}
                      min={0}
                      max={30_000}
                      step={500}
                      ariaLabel="Your share of the other housing cost"
                    />
                  </Field>
                )}
              </SectionCard>
            )}

            {showHousehold && (
              <SectionCard title="Household">
                <FieldSet legend="Do you have other homes you plan to keep?">
                  <YesNo
                    name="Other homes kept"
                    value={keepsProperty}
                    onChange={setKeepsProperty}
                  />
                </FieldSet>

                {keepsProperty && (
                  <Field
                    label="What that home costs you per month"
                    htmlFor="ot-mortgage-kept-cost"
                    help="Loan, fee and running costs together. It counts against what you can borrow."
                  >
                    <MoneyInput
                      id="ot-mortgage-kept-cost"
                      value={keptCost}
                      onChange={setKeptCost}
                      min={0}
                      max={40_000}
                      step={500}
                      ariaLabel="Monthly cost of the home you keep"
                    />
                  </Field>
                )}

                <FieldSet legend="Children under 20 living at home">
                  <YesNo name="Children under 20 at home" value={hasChildren} onChange={setHasChildren} />
                </FieldSet>

                {hasChildren && (
                  <Field label="How many?" htmlFor="ot-mortgage-children">
                    <MoneyInput
                      id="ot-mortgage-children"
                      value={children}
                      onChange={next => setChildren(Math.min(next, 8))}
                      min={1}
                      max={8}
                      step={1}
                      unit="kids"
                      ariaLabel="Number of children under 20 living at home"
                    />
                  </Field>
                )}
              </SectionCard>
            )}

            {showOtherExpenses && (
              <SectionCard title="Other expenses">
                <FieldSet legend="Are you repaying a student loan?">
                  <YesNo name="Student loan" value={hasStudentLoan} onChange={setHasStudentLoan} />
                </FieldSet>

                {hasStudentLoan && (
                  <Field label="Student loan repayment, per month" htmlFor="ot-mortgage-csn">
                    <MoneyInput
                      id="ot-mortgage-csn"
                      value={studentLoan}
                      onChange={setStudentLoan}
                      min={0}
                      max={10_000}
                      step={100}
                      ariaLabel="Student loan repayment per month"
                    />
                  </Field>
                )}

                <FieldSet legend="Do you have other loans, credits or credit cards?">
                  <YesNo name="Other loans" value={hasOtherLoans} onChange={setHasOtherLoans} />
                </FieldSet>

                {hasOtherLoans && (
                  <Field
                    label="What they cost you per month"
                    htmlFor="ot-mortgage-other-loans"
                    help="Interest and repayment together, across every loan and card."
                  >
                    <MoneyInput
                      id="ot-mortgage-other-loans"
                      value={otherLoans}
                      onChange={setOtherLoans}
                      min={0}
                      max={40_000}
                      step={500}
                      ariaLabel="Other loan costs per month"
                    />
                  </Field>
                )}
              </SectionCard>
            )}

            {ctaLabel && (
              <div className="bg-canvas p-md text-right md:p-lg">
                <Button
                  variant="accent"
                  href={ctaUrl || undefined}
                  trailingIcon={<span aria-hidden="true">→</span>}
                >
                  <span {...epi.ctaLabel}>{ctaLabel}</span>
                </Button>
              </div>
            )}

            {disclaimer && (
              <p className="text-label leading-body text-fg-muted" {...epi.disclaimer}>
                {disclaimer}
              </p>
            )}
          </div>

          {/* ── The result panel ───────────────────────────────────────────── */}
          <aside
            className={cn(
              'flex flex-col bg-canvas',
              stickyPanel && 'lg:sticky lg:top-[calc(var(--ot-site-header-h)+var(--ot-space-md))]',
            )}
          >
            <div className="p-md">
              <p className="text-label font-semibold leading-body text-brand">
                {purpose === 'move' ? 'You want to move' : 'You want to borrow'}
              </p>
              <p
                className="mt-xs flex items-start gap-1 text-hero font-bold leading-headline tracking-headline text-brand tabular-nums"
                aria-live="polite"
              >
                {formatKr(result.loan)}
                <span className="mt-1 text-label font-semibold">kr</span>
              </p>
            </div>
            <Scallop />

            <div className="border-t border-fg/10 p-md">
              <p className="text-label font-semibold leading-body text-brand">
                Estimated cost for the home
              </p>
              <p className="text-subhead font-bold leading-subhead text-fg tabular-nums" aria-live="polite">
                {formatKr(result.totalPerMonth)} kr/month
              </p>
            </div>

            <div className="border-t border-fg/10 p-md">
              <label
                htmlFor="ot-mortgage-rate"
                className="block text-label font-semibold leading-body text-brand"
              >
                Calculate with a different interest rate
              </label>
              <div className="mt-xs flex items-center gap-sm">
                <input
                  id="ot-mortgage-rate-slider"
                  type="range"
                  className="w-full cursor-pointer accent-[var(--ot-brand)]"
                  min={0.5}
                  max={8}
                  step={0.01}
                  value={rate}
                  onChange={e => {
                    setRate(Number(e.target.value))
                    setRateText(e.target.value)
                  }}
                  aria-label="Interest rate slider"
                  aria-valuetext={`${rate.toFixed(2)} percent`}
                />
                <div className="relative w-24 flex-none">
                  <input
                    id="ot-mortgage-rate"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className="w-full rounded-input border border-fg/25 bg-canvas px-sm py-1.5 pr-7 text-body text-fg tabular-nums focus:border-brand focus:outline-2 focus:outline-brand"
                    value={rateText}
                    onChange={e => {
                      const cleaned = e.target.value.replace(',', '.').replace(/[^\d.]/g, '')
                      setRateText(cleaned)
                      const parsed = Number(cleaned)
                      if (cleaned && Number.isFinite(parsed)) setRate(Math.min(parsed, 20))
                    }}
                    onBlur={() => setRateText(String(rate))}
                  />
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-body font-semibold text-fg-muted"
                  >
                    %
                  </span>
                </div>
              </div>
            </div>

            <RadixAccordion.Root type="multiple" className="border-t border-fg/10">
              <Disclosure value="how" icon={<Percent />} title="How we calculated">
                <Row
                  label={`Interest, ${rate.toFixed(2)}% per year`}
                  value={`${formatKr(result.interestPerMonth)} kr`}
                />
                <Row
                  label={`Amortisation, ${formatPercent(result.amortisationRate)} per year`}
                  value={`${formatKr(result.amortisationPerMonth)} kr`}
                />
                <Row
                  label={RUNNING_COST_LABEL[propertyKind]}
                  value={`${formatKr(result.operatingPerMonth)} kr`}
                />
                <Row
                  label="Total per month"
                  value={`${formatKr(result.totalPerMonth)} kr`}
                  emphasis
                />
                <p className="mt-sm text-label leading-body text-fg-muted">
                  The loan is {formatPercent(result.ltv)}{' '}
                  of the home&apos;s value, so the amortisation requirement is{' '}
                  {result.amortisationRate === 0
                    ? 'nil'
                    : `${formatPercent(result.amortisationRate)} of the loan per year`}
                  {result.amortisationBoost
                    ? ' — including the extra percentage point that applies above 4.5 times your annual income'
                    : ''}
                  . Running costs are an estimate for a {propertyKind === 'apartment' ? 'flat' : propertyKind === 'holiday' ? 'holiday home' : 'house'}
                  {municipality ? ` in ${municipality}` : ''}, not a quote.
                </p>
                {result.overCap && (
                  <p className="mt-sm text-label leading-body text-accent">
                    A mortgage can cover at most {formatPercent(MORTGAGE_CAP_LTV, 0)}{' '}
                    of the home&apos;s value. Above that, the rest has to come from savings
                    or a separate loan on different terms.
                  </p>
                )}
              </Disclosure>

              <Disclosure value="budget" icon={<Wallet />} title="Household budget">
                {showIncome && result.grossPerMonth > 0 ? (
                  <>
                    <Row
                      label="Income after estimated tax"
                      value={`${formatKr(result.netPerMonth)} kr`}
                    />
                    <Row
                      label="Cost of the home"
                      value={`−${formatKr(result.totalPerMonth)} kr`}
                    />
                    <Row
                      label={
                        input.childrenUnder20 > 0
                          ? `Living costs, ${input.applicants} ${input.applicants === 1 ? 'adult' : 'adults'} and ${input.childrenUnder20} ${input.childrenUnder20 === 1 ? 'child' : 'children'}`
                          : `Living costs, ${input.applicants} ${input.applicants === 1 ? 'adult' : 'adults'}`
                      }
                      value={`−${formatKr(result.livingPerMonth)} kr`}
                    />
                    {result.otherDebtPerMonth > 0 && (
                      <Row
                        label="Other loans and housing costs"
                        value={`−${formatKr(result.otherDebtPerMonth)} kr`}
                      />
                    )}
                    <Row
                      label="Left over each month"
                      value={`${result.leftOverPerMonth < 0 ? '−' : ''}${formatKr(Math.abs(result.leftOverPerMonth))} kr`}
                      emphasis
                      negative={result.leftOverPerMonth < 0}
                    />
                    <p className="mt-sm text-label leading-body text-fg-muted">
                      Living costs use the standard amounts a bank applies — food, travel,
                      clothes, insurance and the rest — not your own spending.
                    </p>
                  </>
                ) : (
                  <p className="text-label leading-body text-fg-muted">
                    Fill in the Income section and this becomes a month-by-month budget:
                    income after tax, less the home, less what a household of your size
                    typically spends.
                  </p>
                )}
              </Disclosure>
            </RadixAccordion.Root>

            <div className="border-t border-fg/10 p-md">
              <p className="text-label font-semibold leading-body text-brand">
                Will I get the loan?
              </p>
              <div className="mt-sm">
                <Gauge usage={result.incomeUsage} verdict={result.verdict} />
              </div>
              <p className="mt-sm text-label leading-body text-fg-muted" aria-live="polite">
                {verdictCopy(result.verdict, {
                  maxLoan: result.maxLoanByIncome,
                  leftOver: result.leftOverPerMonth,
                })}
              </p>
            </div>
          </aside>
        </div>
      </div>
    </section>
  )
}

// ── Panel building blocks ─────────────────────────────────────────────────────

function Disclosure({
  value,
  icon,
  title,
  children,
}: {
  value: string
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <RadixAccordion.Item value={value} className="border-b border-fg/10 last:border-b-0">
      <RadixAccordion.Header>
        <RadixAccordion.Trigger
          className={cn(
            'group flex w-full items-center gap-sm px-md py-sm text-left cursor-pointer',
            'text-body font-semibold text-brand',
            'hover:bg-brand-tint/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand',
          )}
        >
          <span aria-hidden="true" className="flex-none [&>svg]:h-4 [&>svg]:w-4">
            {icon}
          </span>
          <span className="flex-1">{title}</span>
          <ChevronDown
            aria-hidden="true"
            className="h-4 w-4 flex-none motion-safe:transition-transform motion-safe:duration-200 group-data-[state=open]:rotate-180"
          />
        </RadixAccordion.Trigger>
      </RadixAccordion.Header>
      <RadixAccordion.Content
        className={cn(
          'overflow-hidden',
          'motion-safe:data-[state=open]:animate-accordion-down',
          'motion-safe:data-[state=closed]:animate-accordion-up',
        )}
      >
        <div className="px-md pb-md">{children}</div>
      </RadixAccordion.Content>
    </RadixAccordion.Item>
  )
}

function Row({
  label,
  value,
  emphasis,
  negative,
}: {
  label: string
  value: string
  emphasis?: boolean
  negative?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-sm py-1 text-label leading-body',
        emphasis && 'mt-xs border-t border-fg/15 pt-sm font-semibold',
      )}
    >
      <span className={emphasis ? 'text-fg' : 'text-fg-muted'}>{label}</span>
      <span
        className={cn(
          'flex-none tabular-nums',
          negative ? 'text-accent' : emphasis ? 'text-brand' : 'text-fg',
        )}
      >
        {value}
      </span>
    </div>
  )
}

function verdictCopy(
  verdict: 'likely' | 'possible' | 'unlikely' | 'unknown',
  o: { maxLoan: number; leftOver: number },
): string {
  switch (verdict) {
    case 'likely':
      return `On these figures the loan sits inside what your income supports — up to about ${formatKr(o.maxLoan)} kr — and leaves roughly ${formatKr(o.leftOver)} kr a month once the home and everyday costs are paid.`
    case 'possible':
      return `This is close to the limit. Your income supports around ${formatKr(o.maxLoan)} kr, and the margin left each month is thin, so an adviser would want to look at the details with you.`
    case 'unlikely':
      return o.leftOver < 0
        ? 'On these figures the household would run short each month, so the loan is unlikely as it stands. Try a larger down payment or a lower price.'
        : `This is more than your income supports, which is roughly ${formatKr(o.maxLoan)} kr. Try a larger down payment or a lower price.`
    default:
      return 'Fill in your income and we can estimate whether the loan is within reach.'
  }
}
