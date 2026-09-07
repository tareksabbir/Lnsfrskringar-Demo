import type { NotificationFrame, NotificationTone } from '@/cms/styling/OT_NotificationBlock.styling'

/**
 * How this site presents an OT_NotificationBlock left at its default settings.
 *
 * The Länsförsäkringar sites share one CMS instance and one content type, so an
 * advisory written once has to look native on each of them. This file is the
 * single sanctioned divergence between the forks: LF Skåne answers in the red
 * accent with a hatched plate, LF Stockholm in navy with an outlined ring. Every
 * other file in the block is identical across repos — keep it that way, and put
 * per-site presentation here rather than branching inside the component.
 *
 * An editor can still override both axes per placement via the display template.
 */
export const SITE_NOTIFICATION_PRESET: { tone: NotificationTone; frame: NotificationFrame } = {
  tone:  'brand',
  frame: 'ring',
}
