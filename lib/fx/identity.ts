/**
 * The demo visitor's FX identity: who the SDK thinks this browser is, and the
 * attributes its audience conditions get to evaluate.
 *
 * This module is the single definition of that identity, deliberately shared by
 * four things that would otherwise drift apart:
 *
 *   - the panel in the site menu, where an operator edits the values
 *   - `variant-resolver.ts`, which sends them with the server-side decision
 *   - `browser-client.ts`, which sends them with client-side decisions and ODP
 *   - `scripts/create_fx_attributes.mjs`, which creates the matching attributes
 *     in the Optimizely project
 *
 * The last one is the reason the specs carry `name`/`description` as well as a
 * key: an attribute typed by hand into the FX UI and an attribute sent by this
 * app have to agree on the key exactly, or the audience silently never matches —
 * and "silently never matches" is indistinguishable from "the experiment is not
 * running", which has already cost this project a debugging session once.
 *
 * ── Why a cookie rather than sessionStorage ────────────────────────────────
 * The FX decision for a page is made on the SERVER (see resolveContentVariant),
 * so whatever holds these values has to travel with the request. sessionStorage
 * does not leave the browser, so attributes kept there could only ever affect
 * client-side decisions, and a demo where the server and the browser disagree
 * about who the visitor is would be worse than no panel at all. A cookie is
 * readable in both places, which is the whole requirement.
 *
 * Not httpOnly, for the same reason `optimizely_user_id` is not: the panel is
 * browser code and has to write it.
 */

/** Cookie holding the attribute values, as URL-encoded JSON. */
export const FX_ATTRS_COOKIE = 'optimizely_user_attrs'

/** Cookie holding the canonical visitor id. Minted by proxy.ts; see there. */
export const FX_USER_ID_COOKIE = 'optimizely_user_id'

/** A year, matching the visitor-id cookie so identity and attributes expire together. */
export const FX_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export type FxAttributeValue = string | number | boolean

type BaseSpec = {
  /** The FX attribute key. Must match the project exactly, case-sensitively. */
  key: string
  /** Label shown in the menu panel, and the attribute name created in FX. */
  label: string
  /** Shown in FX, and as help text under the control. */
  description: string
}

export type FxAttributeSpec =
  | (BaseSpec & { type: 'select'; options: { value: string; label: string }[]; default: string })
  | (BaseSpec & { type: 'number'; min: number; max: number; default: number })
  | (BaseSpec & { type: 'boolean'; default: boolean })

/**
 * The four attributes this demo ships.
 *
 * Chosen to cover the three value types an FX audience can test — string
 * (`customer_type`), number (`age`, `policies_held`) and boolean
 * (`is_homeowner`) — so a solution engineer can demonstrate every condition
 * editor without adding anything. They are insurance-shaped rather than
 * generic (`plan`, `tier`) because the audiences built on them get shown to
 * customers, and a condition reading `customer_type is prospect` explains
 * itself where `segment is A` does not.
 */
export const FX_ATTRIBUTE_SPECS: readonly FxAttributeSpec[] = [
  {
    key: 'customer_type',
    label: 'Customer type',
    description: 'Where this visitor stands with us: never bought, holds a policy, or is a member/owner.',
    type: 'select',
    options: [
      { value: 'prospect', label: 'Prospect — no policy yet' },
      { value: 'customer', label: 'Customer — holds a policy' },
      { value: 'member',   label: 'Member — customer and part-owner' },
    ],
    default: 'prospect',
  },
  {
    key: 'age',
    label: 'Age',
    description: 'Exact age. Numeric, so an audience can band it however it likes with >, <, ≥.',
    type: 'number',
    min: 18,
    max: 120,
    default: 35,
  },
  {
    key: 'policies_held',
    label: 'Policies held',
    description: 'How many policies this household already has. Numeric, so audiences can use >, <, ≥.',
    type: 'number',
    min: 0,
    max: 10,
    default: 0,
  },
  {
    key: 'is_homeowner',
    label: 'Homeowner',
    description: 'Owns rather than rents. Boolean, for a plain is/is-not condition.',
    type: 'boolean',
    default: false,
  },
] as const

/** Every value at its shipped default — the identity a fresh visitor gets. */
export function defaultFxAttributes(): Record<string, FxAttributeValue> {
  return Object.fromEntries(FX_ATTRIBUTE_SPECS.map(s => [s.key, s.default]))
}

/**
 * Parses the cookie into attributes, keeping only keys this app declares and
 * coercing each to its declared type.
 *
 * Strict on purpose. The cookie is browser-writable, so it is untrusted input,
 * and an unexpected shape here would otherwise reach `decide()` as a garbage
 * attribute — where FX does not reject it, it just fails to match, producing a
 * silent wrong answer rather than an error. Anything unrecognised is dropped
 * and the default stands.
 */
export function parseFxAttributes(raw: string | null | undefined): Record<string, FxAttributeValue> {
  const out = defaultFxAttributes()
  if (!raw) return out

  let parsed: unknown
  try {
    parsed = JSON.parse(decodeURIComponent(raw))
  } catch {
    return out
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return out
  const bag = parsed as Record<string, unknown>

  for (const spec of FX_ATTRIBUTE_SPECS) {
    const v = bag[spec.key]
    if (v === undefined || v === null) continue

    if (spec.type === 'select') {
      if (typeof v === 'string' && spec.options.some(o => o.value === v)) out[spec.key] = v
    } else if (spec.type === 'number') {
      const n = typeof v === 'number' ? v : Number(v)
      if (Number.isFinite(n)) out[spec.key] = Math.min(spec.max, Math.max(spec.min, Math.round(n)))
    } else {
      // Accept the string forms too: a cookie round-trip can stringify a boolean.
      if (typeof v === 'boolean') out[spec.key] = v
      else if (v === 'true' || v === 'false') out[spec.key] = v === 'true'
    }
  }
  return out
}

/** The cookie value for a set of attributes. Encoded, since JSON contains commas. */
export function serializeFxAttributes(attrs: Record<string, FxAttributeValue>): string {
  return encodeURIComponent(JSON.stringify(attrs))
}
