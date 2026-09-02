import { ContentProps } from '@optimizely/cms-sdk'
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import { OT_CompareTable as OT_CompareTableContentType } from '@/cms/content-types/OT_CompareTable'
import CompareTable, { type CompareTableStyleOptions } from '@/components/blocks/CompareTable'

type Props = {
  content:          ContentProps<typeof OT_CompareTableContentType>
  displaySettings?: Record<string, string | boolean>
}

/** CMS array properties arrive as string[] or, when unset, undefined. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const strings = (v: any): string[] =>
  Array.isArray(v) ? v.map(x => String(x ?? '')) : []

export default function OT_CompareTableAdapter({ content, displaySettings = {} }: Props) {
  const { pa } = getPreviewUtils(content)

  return (
    <div {...pa(content.__composition)} className="w-full">
      <CompareTable
        headline={content.headline ?? undefined}
        intro={content.intro ?? undefined}
        columnLabels={strings(content.columnLabels)}
        rowLabels={strings(content.rowLabels)}
        cells={strings(content.cells)}
        styleOptions={{
          color: String(displaySettings.color ?? 'surface') as CompareTableStyleOptions['color'],
        }}
      />
    </div>
  )
}
