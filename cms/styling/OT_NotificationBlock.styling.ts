import { SITE_NOTIFICATION_PRESET } from '@/lib/siteNotification'

export type NotificationTone    = 'accent' | 'brand' | 'warning' | 'neutral'
export type NotificationFrame   = 'plate' | 'ring'
export type NotificationLayout  = 'band' | 'stacked'
export type NotificationDensity = 'default' | 'compact'

export type NotificationStyleOptions = {
  tone:        NotificationTone
  frame:       NotificationFrame
  layout:      NotificationLayout
  density:     NotificationDensity
  dismissible: boolean
  icon:        string
}

const TONES:  readonly NotificationTone[]  = ['accent', 'brand', 'warning', 'neutral']
const FRAMES: readonly NotificationFrame[] = ['plate', 'ring']

export function getNotificationStyles(s: Record<string, string | boolean>): NotificationStyleOptions {
  // 'site' (and anything unrecognised) resolves to the per-site preset, which is
  // what makes one shared content type render as each site's own notice.
  const tone  = TONES.includes(s.tone as NotificationTone)
    ? (s.tone as NotificationTone)
    : SITE_NOTIFICATION_PRESET.tone
  const frame = FRAMES.includes(s.frame as NotificationFrame)
    ? (s.frame as NotificationFrame)
    : SITE_NOTIFICATION_PRESET.frame

  return {
    tone,
    frame,
    layout:      (s.layout  ?? 'band')    as NotificationLayout,
    density:     (s.density ?? 'default') as NotificationDensity,
    dismissible: s.dismissible === 'on' || s.dismissible === true,
    icon:        String(s.icon ?? 'none'),
  }
}
