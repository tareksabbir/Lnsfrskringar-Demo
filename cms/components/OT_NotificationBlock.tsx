import { ContentProps }        from '@optimizely/cms-sdk'
import { getPreviewUtils }     from '@optimizely/cms-sdk/react/server'
import { OT_NotificationBlock as OT_NotificationBlockContentType } from '@/cms/content-types/OT_NotificationBlock'
import { getNotificationStyles } from '@/cms/styling/OT_NotificationBlock.styling'
import NotificationBlock       from '@/components/blocks/NotificationBlock'

type Props = {
  content:          ContentProps<typeof OT_NotificationBlockContentType>
  displaySettings?: Record<string, string | boolean>
}

export default function OT_NotificationBlockAdapter({ content, displaySettings = {} }: Props) {
  const { pa } = getPreviewUtils(content)
  // `layout` is config-as-content, so it arrives on the content and is merged
  // into the styling input alongside the display settings.
  const styleOptions = getNotificationStyles(
    content.layout ? { ...displaySettings, layout: content.layout } : displaySettings,
  )
  const entranceAnimation = String(displaySettings?.entranceAnimation ?? 'none')

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ctaUrl = (content.ctaUrl as any)?.default ?? content.ctaUrl ?? undefined

  return (
    <div
      {...pa(content.__composition)}
      data-stagger={entranceAnimation !== 'none' ? entranceAnimation : undefined}
    >
      <NotificationBlock
        heading={content.heading ?? ''}
        label={content.label     ?? undefined}
        body={content.body       ?? undefined}
        ctaLabel={content.ctaLabel ?? undefined}
        ctaUrl={typeof ctaUrl === 'string' ? ctaUrl : undefined}
        styleOptions={styleOptions}
        // The UI renders through a client component and `pa` is a function, so
        // it cannot cross the boundary — the attributes are computed here and
        // passed as plain objects (each `{}` outside edit context).
        epi={{
          label:    pa('label'),
          heading:  pa('heading'),
          body:     pa('body'),
          ctaLabel: pa('ctaLabel'),
        }}
      />
    </div>
  )
}
