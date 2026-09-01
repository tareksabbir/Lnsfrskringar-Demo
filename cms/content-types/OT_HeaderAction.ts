import { contentType } from '@optimizely/cms-sdk'
import { ICON_ENUM_WITH_NONE } from '../display-templates/_shared/iconChoices'

/**
 * A single icon + label action in the header's right-hand cluster — the
 * "County" and "Log in" entries in the LF reference.
 *
 * Deliberately NOT reusing OT_NavigationItem: these are terminal actions, never
 * dropdown parents, and the icon is required to read correctly rather than being
 * the optional mega-menu decoration OT_NavigationSubItem.icon is. Modelling them
 * separately keeps an editor from putting sub-items on something the header has
 * nowhere to render.
 *
 * Search and Menu are NOT modelled here. They are structural — Search opens the
 * search overlay and Menu opens the drawer — so they have no destination for an
 * editor to set, and exposing them as links would invite one.
 */
export const OT_HeaderAction = contentType({
  key: 'OT_HeaderAction',
  displayName: 'Header Action',
  baseType: '_component',
  properties: {
    menuLink: {
      type: 'link',
      displayName: 'Link',
      group: 'OT_Content',
      sortOrder: 10,
    },
    icon: {
      type: 'string',
      displayName: 'Icon',
      description: 'Shown to the left of the label. Uses the shared canonical icon library.',
      format: 'selectOne',
      enum: ICON_ENUM_WITH_NONE,
      group: 'OT_Content',
      sortOrder: 20,
      // Not localized — icon choice is structural, not language-dependent.
    },
  },
})
