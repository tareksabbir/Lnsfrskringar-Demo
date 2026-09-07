import { getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import UrlField from '@/components/forms/UrlField'
import { parseValidators } from '@/cms/forms/validators'

type Props = { content: any }

export default function OptiFormsUrlElementAdapter({ content }: Props) {
  const { pa } = getPreviewUtils(content)
  const id = content._metadata?.key ?? 'field'
  // The submitted key is SubmissionFieldName — the name an editor gives the
  // field in the CMS, and the key it arrives under. Falling back to the content
  // key would submit a GUID, which nothing downstream can read.
  const name = content.SubmissionFieldName ?? id

  return (
    <div className="w-full" {...pa(content.__composition)}>
      <UrlField
        id={id}
        name={name}
        label={content.Label ?? undefined}
        placeholder={content.Placeholder ?? undefined}
        tooltip={content.Tooltip ?? undefined}
        defaultValue={content.PredefinedValue ?? undefined}
        required={parseValidators(content.Validators).required}
      />
    </div>
  )
}
