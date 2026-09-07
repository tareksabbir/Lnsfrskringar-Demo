import { displayTemplate }       from '@optimizely/cms-sdk'
import { ICON_CHOICES_WITH_NONE } from './_shared/iconChoices'

export const OT_NotificationDefault = displayTemplate({
  key:         'OT_NotificationDefault',
  displayName: 'Notification Default',
  contentType: 'OT_NotificationBlock',
  isDefault:   true,
  settings: {

    // ── Tone ─────────────────────────────────────────────────────────────────
    // `site` defers to SITE_NOTIFICATION_PRESET, which is the one file that
    // differs between the LF sites — leave it alone unless a single placement
    // needs to break from the site's own notice colour.
    tone: {
      displayName: 'Tone',
      editor:      'select',
      sortOrder:   10,
      choices: {
        site:    { displayName: 'Site preset (Default)', sortOrder: 10 },
        accent:  { displayName: 'Accent',                sortOrder: 20 },
        brand:   { displayName: 'Brand',                 sortOrder: 30 },
        warning: { displayName: 'Warning',               sortOrder: 40 },
        neutral: { displayName: 'Neutral',               sortOrder: 50 },
      },
    },

    // ── Frame ────────────────────────────────────────────────────────────────
    frame: {
      displayName: 'Icon frame',
      editor:      'select',
      sortOrder:   20,
      choices: {
        site:  { displayName: 'Site preset (Default)',   sortOrder: 10 },
        plate: { displayName: 'Plate — filled, hatched', sortOrder: 20 },
        ring:  { displayName: 'Ring — outlined',         sortOrder: 30 },
      },
    },

    // ── Density ──────────────────────────────────────────────────────────────
    density: {
      displayName: 'Density',
      editor:      'select',
      sortOrder:   30,
      choices: {
        default: { displayName: 'Default (Default)', sortOrder: 10 },
        compact: { displayName: 'Compact',           sortOrder: 20 },
      },
    },

    // ── Dismissible ──────────────────────────────────────────────────────────
    dismissible: {
      displayName: 'Dismissible',
      editor:      'select',
      sortOrder:   40,
      choices: {
        off: { displayName: 'Off (Default)', sortOrder: 10 },
        on:  { displayName: 'On',            sortOrder: 20 },
      },
    },

    // ── Icon ─────────────────────────────────────────────────────────────────
    // Falls back to a shield when left at None, so the block never renders
    // an advisory without a category signal.
    icon: {
      displayName: 'Icon',
      editor:      'select',
      sortOrder:   50,
      choices:     ICON_CHOICES_WITH_NONE,
    },

    // ── Entrance animation ───────────────────────────────────────────────────
    entranceAnimation: {
      displayName: 'Entrance animation',
      editor:      'select',
      sortOrder:   60,
      choices: {
        none:  { displayName: 'None (Default)', sortOrder: 10 },
        fade:  { displayName: 'Fade in',        sortOrder: 20 },
        slide: { displayName: 'Slide up',       sortOrder: 30 },
      },
    },

  },
})
