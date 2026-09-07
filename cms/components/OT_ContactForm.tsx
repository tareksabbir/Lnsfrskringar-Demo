import { ContentProps } from '@optimizely/cms-sdk'
import { getPreviewUtils } from '@optimizely/cms-sdk/react/server'
import { OT_ContactForm as OT_ContactFormContentType } from '@/cms/content-types/OT_ContactForm'
import ContactForm from '@/components/blocks/ContactForm'

type Props = {
  content:          ContentProps<typeof OT_ContactFormContentType>
  displaySettings?: Record<string, string | boolean>
}

export default function OT_ContactFormAdapter({ content, displaySettings = {} }: Props) {
  const { pa } = getPreviewUtils(content)

  return (
    <div {...pa(content.__composition)} className="w-full">
      <ContactForm
        heading={content.heading ?? undefined}
        intro={content.intro ?? undefined}
        nameLabel={content.nameLabel ?? undefined}
        emailLabel={content.emailLabel ?? undefined}
        subjectLabel={content.subjectLabel ?? undefined}
        messageLabel={content.messageLabel ?? undefined}
        consentText={content.consentText ?? undefined}
        submitLabel={content.submitLabel ?? undefined}
        successMessage={content.successMessage ?? undefined}
        layout={(String(displaySettings.layout ?? 'stacked')) as 'stacked' | 'compact'}
        color={(String(displaySettings.color ?? 'surface')) as 'surface' | 'canvas' | 'tint'}
        // ContactForm is a client component, so `pa` cannot be passed — the
        // attributes are computed here. See Optimizely.md, "pa() has two shapes".
        epi={{
          heading:      pa('heading'),
          intro:        pa('intro'),
          nameLabel:    pa('nameLabel'),
          emailLabel:   pa('emailLabel'),
          subjectLabel: pa('subjectLabel'),
          messageLabel: pa('messageLabel'),
          consentText:  pa('consentText'),
          submitLabel:  pa('submitLabel'),
          successMessage: pa('successMessage'),
        }}
      />
    </div>
  )
}
