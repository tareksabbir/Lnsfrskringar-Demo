import { getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import ChoiceField from '@/components/forms/ChoiceField'
import { parseValidators } from '@/cms/forms/validators'
import { parseOptions } from '@/cms/forms/options'

type Props = { content: any }

export default function OptiFormsChoiceElementAdapter({ content }: Props) {
  const { pa } = getPreviewUtils(content)
  const id = content._metadata?.key ?? 'field'
  // The submitted key is SubmissionFieldName — the name an editor gives the
  // field in the CMS, and the key it arrives under. Falling back to the content
  // key would submit a GUID, which nothing downstream can read.
  const name = content.SubmissionFieldName ?? id

  return (
    <div className="w-full" {...pa(content.__composition)}>
      <ChoiceField
        id={id}
        name={name}
        label={content.Label ?? undefined}
        tooltip={content.Tooltip ?? undefined}
        options={parseOptions(content.Options)}
        allowMultiSelect={content.AllowMultiSelect ?? false}
        required={parseValidators(content.Validators).required}
      />
    </div>
  )
}
