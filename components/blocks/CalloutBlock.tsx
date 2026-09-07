import CalloutBlockClient       from './CalloutBlock.client'
import type { CalloutStyleOptions } from '@/cms/styling/OT_CalloutBlock.styling'

/** Precomputed `data-epi-edit` attributes, keyed by property name. */
export type EpiEditAttrs = Partial<Record<string, Record<string, string | undefined>>>

export type CalloutBlockProps = {
  heading:       string
  body?:         string
  ctaLabel?:     string
  ctaUrl?:       string
  /** From the adapter. Empty outside Visual Builder's edit context. */
  epi?:          EpiEditAttrs
  styleOptions?: Partial<CalloutStyleOptions>
}

export default function CalloutBlock(props: CalloutBlockProps) {
  return <CalloutBlockClient {...props} />
}
