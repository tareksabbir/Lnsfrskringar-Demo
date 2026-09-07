import { getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import RangeField from '@/components/forms/RangeField'

type Props = { content: any }

export default function OptiFormsRangeElementAdapter({ content }: Props) {
  const { pa } = getPreviewUtils(content)
  const id = content._metadata?.key ?? 'field'
  // The submitted key is SubmissionFieldName — the name an editor gives the
  // field in the CMS, and the key it arrives under. Falling back to the content
  // key would submit a GUID, which nothing downstream can read.
  const name = content.SubmissionFieldName ?? id

  return (
    <div className="w-full" {...pa(content.__composition)}>
      <RangeField
        id={id}
        name={name}
        label={content.Label ?? undefined}
        tooltip={content.Tooltip ?? undefined}
        defaultValue={content.PredefinedValue ?? undefined}
        min={content.Min ?? 0}
        max={content.Max ?? 100}
        step={content.Increment ?? 1}
      />
    </div>
  )
}
