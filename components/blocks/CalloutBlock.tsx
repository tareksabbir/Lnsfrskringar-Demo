import CalloutBlockClient       from './CalloutBlock.client'
import type { CalloutStyleOptions } from '@/cms/styling/OT_CalloutBlock.styling'

export type CalloutBlockProps = {
  heading:       string
  body?:         string
  ctaLabel?:     string
  ctaUrl?:       string
  styleOptions?: Partial<CalloutStyleOptions>
}

export default function CalloutBlock(props: CalloutBlockProps) {
  return <CalloutBlockClient {...props} />
}
