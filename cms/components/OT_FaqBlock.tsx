import { ContentProps } from '@optimizely/cms-sdk'
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import { OT_FaqBlock as OT_FaqBlockContentType } from '@/cms/content-types/OT_FaqBlock'
import FaqAccordion, {
  type FaqItem,
  type FaqAccordionStyleOptions,
} from '@/components/blocks/FaqAccordion'

type Props = {
  content:          ContentProps<typeof OT_FaqBlockContentType>
  displaySettings?: Record<string, string | boolean>
}

function buildStyleOptions(ds: Record<string, string | boolean>): FaqAccordionStyleOptions {
  return {
    color:    String(ds.color    ?? 'surface') as FaqAccordionStyleOptions['color'],
    openMode: String(ds.openMode ?? 'single')  as FaqAccordionStyleOptions['openMode'],
    // Select editors store booleans as the strings 'true' / 'false'.
    defaultOpen: String(ds.defaultOpen) === 'true',
  }
}

/**
 * Zips the two parallel arrays into rows.
 *
 * They are parallel because an `elementEnabled` type may not hold an array of
 * components — see OT_FaqBlock for the full reasoning. Zipping to the SHORTER
 * array is deliberate: a half-finished edit then shows fewer complete rows
 * rather than rendering a question with an empty answer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildItems(content: any): FaqItem[] {
  const questions: string[] = Array.isArray(content.questions) ? content.questions : []
  const answers:   string[] = Array.isArray(content.answers)   ? content.answers   : []
  const rows: FaqItem[] = []
  for (let i = 0; i < Math.min(questions.length, answers.length); i++) {
    const q = String(questions[i] ?? '').trim()
    const a = String(answers[i]   ?? '').trim()
    if (q && a) rows.push({ question: q, answer: a })
  }
  return rows
}

export default function OT_FaqBlockAdapter({ content, displaySettings = {} }: Props) {
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
