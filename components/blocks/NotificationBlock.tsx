import NotificationBlockClient          from './NotificationBlock.client'
import type { NotificationStyleOptions } from '@/cms/styling/OT_NotificationBlock.styling'

/** Precomputed `data-epi-edit` attributes, keyed by property name. */
export type EpiEditAttrs = Partial<Record<string, Record<string, string | undefined>>>

export type NotificationBlockProps = {
  heading:       string
  label?:        string
  body?:         string
  ctaLabel?:     string
  ctaUrl?:       string
  /** From the adapter. Empty outside Visual Builder's edit context. */
  epi?:          EpiEditAttrs
  styleOptions?: Partial<NotificationStyleOptions>
}

export default function NotificationBlock(props: NotificationBlockProps) {
  return <NotificationBlockClient {...props} />
}
