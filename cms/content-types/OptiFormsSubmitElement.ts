import { contentType } from '@optimizely/cms-sdk'

/**
 * Optimizely Forms element — the CMS owns this type.
 *
 * `source: _server` in /v1/contenttypes: the CMS installs it when Forms is
 * activated. This file is NOT a definition to push. It exists so the SDK's
 * registry knows the shape and generates a query asking for the right fields.
 * Drift from the server means the query asks Graph for a field it does not
 * have, and every page carrying a form fails with HTTP 400.
 *
 * ── One deliberate divergence ───────────────────────────────────────────────
 * The server declares `compositionBehaviors: ['formsElementEnabled']`. This
 * says `elementEnabled`, because cms-sdk 2.2.0 predates Forms and its union is
 * only 'sectionEnabled' | 'elementEnabled'.
 *
 * That is not a fudge to make TypeScript quiet. This value has exactly one job
 * here: the SDK's isExperienceComponent uses a NON-EMPTY behaviours list to
 * decide which types get an _IComponent fragment in the generated query, which
 * is what we need. Where an editor may actually place the element is decided
 * by the CMS from its own value, not by this file.
 *
 * Generated from the live schema. Re-check with GET /v1/contenttypes/{key}
 * after any Forms upgrade.
 */

export const OptiFormsSubmitElement = contentType({
  key: 'OptiFormsSubmitElement',
  displayName: 'Submit',
  baseType: '_component',
  compositionBehaviors: ['elementEnabled'],
  properties: {
    Label:                            { type: 'string', isLocalized: true },
    Tooltip:                          { type: 'string', isLocalized: true },
  },
})
