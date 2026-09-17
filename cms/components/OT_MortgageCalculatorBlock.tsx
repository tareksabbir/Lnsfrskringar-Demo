import { ContentProps } from '@optimizely/cms-sdk'
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import { OT_MortgageCalculatorBlock as OT_MortgageCalculatorBlockContentType } from '@/cms/content-types/OT_MortgageCalculatorBlock'
import { getMortgageCalculatorStyles } from '@/cms/styling/OT_MortgageCalculatorBlock.styling'
import MortgageCalculatorBlock from '@/components/blocks/MortgageCalculatorBlock'
import type { Purpose } from '@/components/blocks/mortgage/model'

type Props = {
  content:          ContentProps<typeof OT_MortgageCalculatorBlockContentType>
  displaySettings?: Record<string, string | boolean>
}

const PURPOSES = ['purchase', 'promise', 'move', 'increase'] as const

/**
 * An empty CMS number arrives as null, and 0 is a legitimate down payment, so
 * "unset" has to be distinguished from "zero". Undefined lets the component's
 * own default apply; 0 is passed through.
 */
function num(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

export default function OT_MortgageCalculatorBlockAdapter({
  content,
  displaySettings = {},
}: Props) {
  const { pa }            = getPreviewUtils(content)
  const entranceAnimation = String(displaySettings?.entranceAnimation ?? 'none')

  // Presentation comes from the display settings; which sections the form asks
  // about is a content field. The fields are phrased as "hide", so an unset one
  // (null on every block saved before they existed) leaves the section showing.
  const styleOptions = {
    ...getMortgageCalculatorStyles(displaySettings),
    showIncome:        !content.hideIncome,
    showHousehold:     !content.hideHousehold,
    showOtherExpenses: !content.hideOtherExpenses,
  }

  const purpose = PURPOSES.includes(content.purpose as Purpose)
    ? (content.purpose as Purpose)
    : undefined

  return (
    <div
      {...pa(content.__composition)}
      className="w-full"
      data-stagger={entranceAnimation !== 'none' ? entranceAnimation : undefined}
    >
      <MortgageCalculatorBlock
        heading={content.heading || undefined}
        headingLevel={(content.headingLevel as 'h1' | 'h2' | undefined) ?? 'h2'}
        intro={content.intro || undefined}
        purpose={purpose}
        price={num(content.price)}
        downPayment={num(content.downPayment)}
        interestRate={num(content.interestRate)}
        income1={num(content.income1)}
        income2={num(content.income2)}
        ctaLabel={content.ctaLabel ?? undefined}
        ctaUrl={content.ctaUrl?.default ?? undefined}
        disclaimer={content.disclaimer ?? undefined}
        styleOptions={styleOptions}
        // The calculator is a client component, so `pa` cannot cross the
        // boundary as a function — the overlay attributes are computed here.
        // Only the four editorial fields get one; the numeric starting values
        // are settings rather than text on the page, and refetch on save keeps
        // them current.
        epi={{
          heading:    pa('heading'),
          intro:      pa('intro'),
          ctaLabel:   pa('ctaLabel'),
          disclaimer: pa('disclaimer'),
        }}
      />
    </div>
  )
}
