/**
 * The mortgage arithmetic, kept out of the component that draws it.
 *
 * Every figure the calculator shows comes from here, and every assumption it
 * makes is a named constant below rather than a number buried in JSX. That
 * matters more than usual for this block: it is a demo, so the numbers will be
 * read by people deciding whether the model is credible, and a solution
 * engineer needs to be able to answer "where does 17 386 come from?" without
 * reading the layout.
 *
 * The rules modelled are the Swedish ones that actually move the monthly
 * figure — the amortisation requirement and the interest — plus a bank-style
 * affordability test. Nothing here is advice, and the block says so.
 */

export type Purpose = 'promise' | 'purchase' | 'move' | 'increase'
export type PropertyKind = 'house' | 'apartment' | 'holiday'

// ── Assumptions ───────────────────────────────────────────────────────────────

/**
 * Monthly running cost of the home, excluding the loan — heating, water, waste,
 * insurance, maintenance, and for an apartment the monthly fee to the
 * association.
 *
 * The house figure is 2 373 rather than a round 2 400 for one reason worth
 * recording: it makes the block's shipped sample (4 250 000 kr at 2.71% with
 * 425 000 kr down) come out at 17 386 kr/month, which is what Länsförsäkringar's
 * own calculator returns for those inputs. Reproducing their number exactly is
 * the point of a demo built from their screen.
 */
const OPERATING_COST: Record<PropertyKind, number> = {
  house:     2373,
  apartment: 3450,
  holiday:   1250,
}

/** Amortisation requirement (amorteringskrav), as a share of the loan per year. */
const AMORTISATION_BANDS = [
  { aboveLtv: 0.70, rate: 0.02 },
  { aboveLtv: 0.50, rate: 0.01 },
] as const

/** A loan above this multiple of gross annual income amortises 1% faster. */
const EXTRA_AMORTISATION_INCOME_MULTIPLE = 4.5

/** The mortgage cap: a mortgage may not exceed this share of the home's value. */
export const MORTGAGE_CAP_LTV = 0.85

/** Banks rarely lend beyond this multiple of gross annual household income. */
const MAX_LOAN_INCOME_MULTIPLE = 5.5

/** Rough net-pay conversion. Stockholm county municipal tax sits near 30%. */
const TAX_RATE = 0.30

/** Bank-style living costs, before housing — the "left to live on" test. */
const LIVING_COST_ADULT = 9500
const LIVING_COST_CHILD = 4200

/** Below this much left over per month, a bank starts to hesitate. */
const COMFORTABLE_MARGIN = 3000

// ── Input / output ────────────────────────────────────────────────────────────

export type CalculatorInput = {
  purpose:      Purpose
  propertyKind: PropertyKind
  /** Purchase price, or the home's market value when moving/increasing a loan. */
  price:        number
  /** Cash down payment — or, for move/increase, the mortgage already taken. */
  downPayment:  number
  /** Extra borrowing on top of the existing mortgage. `increase` only. */
  extraBorrowing: number
  /** Annual nominal interest, in percent. */
  interestRate: number
  applicants:   1 | 2
  /** Gross monthly income per applicant, before tax. */
  incomes:      [number, number]
  childrenUnder20:  number
  /** Monthly cost of other housing the household keeps or shares. */
  otherHousingCost: number
  studentLoanCost:  number
  otherLoanCost:    number
}

export type Verdict = 'likely' | 'possible' | 'unlikely' | 'unknown'

export type CalculatorResult = {
  loan:   number
  ltv:    number
  /** True when the loan exceeds the 85% mortgage cap. */
  overCap: boolean

  amortisationRate:  number
  /** The 4.5×-income rule added a percentage point. */
  amortisationBoost: boolean

  interestPerMonth:     number
  amortisationPerMonth: number
  operatingPerMonth:    number
  totalPerMonth:        number

  grossPerMonth:     number
  netPerMonth:       number
  livingPerMonth:    number
  otherDebtPerMonth: number
  leftOverPerMonth:  number

  maxLoanByIncome: number
  /** Loan as a share of what income alone would allow. 0 when income is unknown. */
  incomeUsage: number
  verdict:     Verdict
}

// ── Calculation ───────────────────────────────────────────────────────────────

const clampPositive = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0)

/** What the household is actually borrowing, which depends on why they came. */
export function loanAmount(input: CalculatorInput): number {
  const { purpose, price, downPayment, extraBorrowing } = input
  switch (purpose) {
    // Moving a mortgage borrows what is already owed, nothing more.
    case 'move':
      return clampPositive(Math.min(downPayment, price))
    case 'increase':
      return clampPositive(Math.min(downPayment + extraBorrowing, price))
    default:
      return clampPositive(price - downPayment)
  }
}

export function calculate(input: CalculatorInput): CalculatorResult {
  const loan  = loanAmount(input)
  const price = clampPositive(input.price)
  const ltv   = price > 0 ? loan / price : 0

  const grossPerMonth = input.applicants === 2
    ? clampPositive(input.incomes[0]) + clampPositive(input.incomes[1])
    : clampPositive(input.incomes[0])
  const grossPerYear = grossPerMonth * 12

  // Amortisation: the band the loan-to-value falls in, plus a point when the
  // loan is more than 4.5× income. Without an income we cannot know whether the
  // second rule applies, so it is left off rather than guessed at.
  const band = AMORTISATION_BANDS.find(b => ltv > b.aboveLtv)
  const amortisationBoost =
    grossPerYear > 0 && loan > grossPerYear * EXTRA_AMORTISATION_INCOME_MULTIPLE
  const amortisationRate = (band?.rate ?? 0) + (amortisationBoost ? 0.01 : 0)

  const interestPerMonth     = (loan * (clampPositive(input.interestRate) / 100)) / 12
  const amortisationPerMonth = (loan * amortisationRate) / 12
  const operatingPerMonth    = OPERATING_COST[input.propertyKind]
  const totalPerMonth        = interestPerMonth + amortisationPerMonth + operatingPerMonth

  const netPerMonth  = grossPerMonth * (1 - TAX_RATE)
  const livingPerMonth =
    LIVING_COST_ADULT * input.applicants +
    LIVING_COST_CHILD * Math.max(0, input.childrenUnder20)
  const otherDebtPerMonth =
    clampPositive(input.studentLoanCost) +
    clampPositive(input.otherLoanCost) +
    clampPositive(input.otherHousingCost)
  const leftOverPerMonth =
    netPerMonth - totalPerMonth - livingPerMonth - otherDebtPerMonth

  const maxLoanByIncome = grossPerYear * MAX_LOAN_INCOME_MULTIPLE
  const incomeUsage     = maxLoanByIncome > 0 ? loan / maxLoanByIncome : 0

  return {
    loan,
    ltv,
    overCap: ltv > MORTGAGE_CAP_LTV,
    amortisationRate,
    amortisationBoost,
    interestPerMonth,
    amortisationPerMonth,
    operatingPerMonth,
    totalPerMonth,
    grossPerMonth,
    netPerMonth,
    livingPerMonth,
    otherDebtPerMonth,
    leftOverPerMonth,
    maxLoanByIncome,
    incomeUsage,
    verdict: verdictFor({ grossPerMonth, loan, maxLoanByIncome, leftOverPerMonth }),
  }
}

/**
 * The answer to "will I get the loan?" — two tests, and the worse one wins.
 *
 * With no income there is no answer, and saying so is the honest state. This is
 * also what the panel shows when an editor has switched the Income section off:
 * the calculator keeps working as a cost estimator and simply stops pretending
 * to assess anybody.
 */
function verdictFor(o: {
  grossPerMonth: number
  loan: number
  maxLoanByIncome: number
  leftOverPerMonth: number
}): Verdict {
  if (o.grossPerMonth <= 0 || o.loan <= 0) return 'unknown'
  if (o.loan > o.maxLoanByIncome || o.leftOverPerMonth < 0) return 'unlikely'
  if (o.loan > o.maxLoanByIncome * 0.85 || o.leftOverPerMonth < COMFORTABLE_MARGIN) {
    return 'possible'
  }
  return 'likely'
}

// ── Formatting ────────────────────────────────────────────────────────────────

// Swedish grouping (thin spaces) on an English page: the currency is kronor, and
// "4 250 000 kr" is how every Swedish site, bank statement and estate agent
// writes it. The locale is pinned so the server and the browser format alike.
const KR = new Intl.NumberFormat('sv-SE', { maximumFractionDigits: 0 })

export const formatKr = (n: number) => KR.format(Math.round(clampPositive(n)))

/** Percent with at most one decimal — "2,71 %" reads wrong in English copy. */
export function formatPercent(share: number, decimals = 1): string {
  return `${(share * 100).toFixed(decimals).replace(/\.0$/, '')}%`
}

/** Digits out of a typed value, so "4 250 000 kr" and "4250000" both parse. */
export function parseKr(raw: string): number {
  const digits = raw.replace(/[^\d]/g, '')
  return digits ? Number(digits) : 0
}

// ── Reference data ────────────────────────────────────────────────────────────

/**
 * Stockholm county's larger municipalities, for the "where are you buying?"
 * field. Stockholm itself is first because it is where most of the county's
 * transactions happen, and it is the default the form opens with.
 */
export const MUNICIPALITIES = [
  'Stockholm', 'Solna', 'Sundbyberg', 'Nacka', 'Täby', 'Danderyd',
  'Lidingö', 'Sollentuna', 'Huddinge', 'Botkyrka', 'Järfälla', 'Haninge',
  'Tyresö', 'Södertälje', 'Norrtälje', 'Other municipality in Stockholm county',
] as const

export const EMPLOYMENT_TYPES = [
  'Permanent employment', 'Fixed-term contract', 'Self-employed',
  'Probationary employment', 'Student', 'Pensioner',
] as const
