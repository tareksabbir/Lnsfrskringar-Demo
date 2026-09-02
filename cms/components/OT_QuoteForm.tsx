import { ContentProps } from '@optimizely/cms-sdk'
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import { OT_QuoteForm as OT_QuoteFormContentType } from '@/cms/content-types/OT_QuoteForm'
import QuoteForm, { type QuoteFormField } from '@/components/blocks/QuoteForm'

type Props = {
  content:          ContentProps<typeof OT_QuoteFormContentType>
  displaySettings?: Record<string, string | boolean>
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const strings = (v: any): string[] => (Array.isArray(v) ? v.map(x => String(x ?? '')) : [])

export default function OT_QuoteFormAdapter({ content, displaySettings = {} }: Props) {
  const { pa } = getPreviewUtils(content)

  // A field is only rendered once it has a label — a half-filled block shows the
  // fields an editor has actually named rather than a blank input.
  const fields: QuoteFormField[] = []
  if (content.field1Label) {
    fields.push({
      label:       content.field1Label,
      placeholder: content.field1Placeholder ?? undefined,
      linkLabel:   content.field1LinkLabel ?? undefined,
      linkUrl:     content.field1LinkUrl?.default ?? undefined,
      platePrefix: String(displaySettings.platePrefix ?? 'true') === 'true',
    })
  }
  if (content.field2Label) {
    fields.push({
      label:       content.field2Label,
      placeholder: content.field2Placeholder ?? undefined,
      help:        content.field2Help ?? undefined,
    })
  }

  return (
    <div {...pa(content.__composition)} className="w-full">
      <QuoteForm
        headline={content.headline ?? undefined}
        intro={content.intro ?? undefined}
        checkItems={strings(content.checkItems)}
        fields={fields}
        ctaLabel={content.ctaLabel ?? undefined}
        ctaUrl={content.ctaUrl?.default ?? undefined}
      />
    </div>
  )
}
