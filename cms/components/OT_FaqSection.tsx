import { ContentProps } from '@optimizely/cms-sdk'
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import { OT_FaqSection as OT_FaqSectionContentType } from '@/cms/content-types/OT_FaqSection'
import AccordionBlock, {
  type AccordionItem,
  type AccordionBlockStyleOptions,
} from '@/components/blocks/AccordionBlock'

type Props = {
  content:          ContentProps<typeof OT_FaqSectionContentType>
  displaySettings?: Record<string, string | boolean>
}

/**
 * Renders OT_FaqSection with the same AccordionBlock the OT_AccordionBlock
 * adapter uses. The two content types differ only in baseType — `_section` here
 * so the CMS will actually let it be placed — so there is no second accordion
 * implementation to keep in step.
 */
function buildStyleOptions(ds: Record<string, string | boolean>): AccordionBlockStyleOptions {
  return {
    color:       String(ds.color       ?? 'surface') as AccordionBlockStyleOptions['color'],
    borderStyle: String(ds.borderStyle ?? 'boxed')   as AccordionBlockStyleOptions['borderStyle'],
    openMode:    String(ds.openMode    ?? 'single')  as AccordionBlockStyleOptions['openMode'],
    // Select editors store booleans as the strings 'true' / 'false'.
    defaultOpen: String(ds.defaultOpen) === 'true',
  }
}

function buildItems(content: any): AccordionItem[] {
  if (!Array.isArray(content.items)) return []
  return (content.items as any[])
    .filter(item => item?.question && item?.answer)
    .map(item => ({ question: String(item.question), answer: String(item.answer) }))
}

export default function OT_FaqSectionAdapter({ content, displaySettings = {} }: Props) {
  const { pa } = getPreviewUtils(content)

  return (
    <div {...pa(content.__composition)} className="w-full">
      <AccordionBlock
        eyebrow={content.eyebrow   ?? undefined}
        headline={content.headline ?? undefined}
        items={buildItems(content)}
        styleOptions={buildStyleOptions(displaySettings)}
      />
    </div>
  )
}
