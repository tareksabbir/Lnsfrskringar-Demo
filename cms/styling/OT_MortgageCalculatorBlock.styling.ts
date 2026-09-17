import type { MortgageCalculatorStyleOptions } from '@/components/blocks/MortgageCalculatorBlock'

/** The presentation half of the style options. Section visibility is a content
 *  field on the block, and the adapter merges the two. */
export type MortgageCalculatorPresentation =
  Pick<MortgageCalculatorStyleOptions, 'color' | 'stickyPanel'>

/**
 * Display settings → typed style options.
 *
 * `stickyPanel` defaults to on, and is compared against the string 'false' as
 * well as the boolean because CMS choice keys arrive as strings.
 */
export function getMortgageCalculatorStyles(
  s: Record<string, string | boolean>,
): MortgageCalculatorPresentation {
  const on = (value: string | boolean | undefined) => value !== false && value !== 'false'

  return {
    color:       s.color === 'canvas' ? 'canvas' : 'surface',
    stickyPanel: on(s.stickyPanel),
  }
}
