import type { QuoteStyleOptions } from '@/components/blocks/QuoteBlock'

export function getQuoteStyles(s: Record<string, string | boolean>): QuoteStyleOptions {
  return {
    color:     (s.color     ?? 'brand')  as QuoteStyleOptions['color'],
    alignment: (s.alignment ?? 'center') as QuoteStyleOptions['alignment'],
    size:      (s.size      ?? 'large')  as QuoteStyleOptions['size'],
  }
}
