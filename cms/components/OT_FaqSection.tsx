import { ContentProps } from '@optimizely/cms-sdk'
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import { OT_FaqSection as OT_FaqSectionContentType } from '@/cms/content-types/OT_FaqSection'
import FaqAccordion, {
  type FaqItem,
  type FaqAccordionStyleOptions,
} from '@/components/blocks/FaqAccordion'

type Props = {
  content:          ContentProps<typeof OT_FaqSectionContentType>
  displaySettings?: Record<string, string | boolean>
}

/**
 * Renders OT_FaqSection with FaqAccordion — the LF FAQ pattern: a white card per
 * question on a grey band, brand-blue question text, and a brand rule under an
 * open question. AccordionBlock draws a different pattern and has a silent
 * twelve-item cap, which would quietly drop three of the fifteen questions here.
 *
 * `borderStyle` from the display template is intentionally not forwarded:
 * FaqAccordion has one row treatment by design, so there is nothing to switch.
 */
function buildStyleOptions(ds: Record<string, string | boolean>): FaqAccordionStyleOptions {
  return {
    color:    String(ds.color    ?? 'surface') as FaqAccordionStyleOptions['color'],
    openMode: String(ds.openMode ?? 'single')  as FaqAccordionStyleOptions['openMode'],
    // Select editors store booleans as the strings 'true' / 'false'.
    defaultOpen: String(ds.defaultOpen) === 'true',
  }
}

function buildItems(content: any): FaqItem[] {
  if (!Array.isArray(content.items)) return []
  return (content.items as any[])
    .filter(item => item?.question && item?.answer)
    .map(item => ({ question: String(item.question), answer: String(item.answer) }))
}

export default function OT_FaqSectionAdapter({ content, displaySettings = {} }: Props) {
  const { pa } = getPreviewUtils(content)

  return (
    <div {...pa(content.__composition)} className="w-full">
      <FaqAccordion
        eyebrow={content.eyebrow   ?? undefined}
        headline={content.headline ?? undefined}
        items={buildItems(content)}
        styleOptions={buildStyleOptions(displaySettings)}
      />
    </div>
  )
}
