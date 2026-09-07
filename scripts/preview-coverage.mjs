/**
 * Which block properties are editable in place in Visual Builder, and which are not.
 *
 *   node scripts/preview-coverage.mjs            # summary
 *   node scripts/preview-coverage.mjs --details  # every missing property
 *   node scripts/preview-coverage.mjs --json
 *
 * ── What it measures ────────────────────────────────────────────────────────
 * The SDK's getPreviewUtils().pa() has two shapes and they do different jobs:
 *
 *   pa(node)        → data-epi-block-id   the block is SELECTABLE
 *   pa('headline')  → data-epi-edit       the property has an OVERLAY and can
 *                                         be patched in place on save
 *
 * Nearly every adapter emits the first. The second is the one that makes an
 * edit appear as you type, and it has to be spread onto the specific element
 * that renders that property — so it is per property, per block, and easy to
 * half-finish. This counts it.
 *
 * A property counts as covered if `pa('name')` appears anywhere in the block
 * component or its adapter. That is a text match, not a proof that the
 * attribute reaches the right element — it catches the absence, which is the
 * common failure, not a misplacement.
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = process.cwd()
const CONTENT_TYPES = join(ROOT, 'cms/content-types')
const ADAPTERS = join(ROOT, 'cms/components')
const COMPONENTS = join(ROOT, 'components')

/**
 * Property groups that never render visible text, so an overlay on them would
 * be meaningless. Everything else is fair game.
 */
const NON_VISUAL_GROUPS = new Set(['OT_SEO', 'OT_Integrations', 'OT_Theme'])

/**
 * Is this property rendered as visible text, i.e. could an element's CONTENT be
 * this value?
 *
 * That is the whole test for data-epi-edit. The attribute marks an element the
 * CMS patches in place on save, so it only makes sense where the property IS
 * the text. Everything else — how many items to show, which layout, which
 * colour, an alt attribute, a content reference — is edited in the property
 * panel and reaches the page through the refetch.
 *
 * Decided from the declared type rather than a list of names, because a list
 * needs extending every time a block is added and quietly rots when nobody
 * does. Booleans, numbers, enums, references and URLs are never rendered text.
 */
/**
 * Configuration that happens to be declared as a plain string, so the
 * type-based test below cannot catch it. Kept deliberately short — every entry
 * is a property whose value never appears as text on the page.
 */
const CONFIG_STRINGS = new Set([
  'headingLevel',    // which tag to render, not what it says
  'siteKey',         // scoping
  'damFolderId',     // an id
  'widgetPosition',  // a slot name
  'chartData',       // serialised data
  'videoUrl',        // a URL with a pattern, not typed 'url'
  'title',           // VideoBlock: the iframe's title attribute
  'valuePrefix',     // ChartBlock: formatting, rendered inside the chart library
  'valueSuffix',
  // Rendered only as part of a COMPUTED value, so no element's content is this
  // property on its own. Patching one in place would replace the whole
  // composite — "Anna Berg" becoming "Anna". These update via the refetch.
  'firstName',       // → practitionerName(first, last, suffix)
  'lastName',
  'suffix',
  'languages',       // → a joined, comma-separated list
  'bio',             // → bioPreview(bio, 160), a truncation
])

function isRenderedText(src, prop) {
  if (CONFIG_STRINGS.has(prop)) return false
  const body = bodyOf(src, prop)
  if (/type:\s*'(boolean|integer|float|contentReference|binary|dateTime|url)'/.test(body)) return false
  // A selectOne enum is a setting, whatever its underlying type.
  if (/format:\s*'selectOne'/.test(body)) return false
  // These live in HTML ATTRIBUTES, not in an element's content, so there is
  // nothing for data-epi-edit to mark: alt text, input placeholders, and the
  // iframe title on a video embed.
  if (/alt$/i.test(prop)) return false
  if (/placeholder$/i.test(prop)) return false
  return true
}

function read(path) {
  try { return readFileSync(path, 'utf8') } catch { return '' }
}

/** Pull top-level property names out of a contentType({ properties: { … } }). */
function propertiesOf(src) {
  const start = src.indexOf('properties:')
  if (start === -1) return []
  const out = []
  // Top-level keys sit at exactly four spaces of indentation inside properties.
  for (const m of src.slice(start).matchAll(/\n {4}([A-Za-z_]\w*):\s*\{/g)) {
    out.push(m[1])
  }
  // Keys written on one line, e.g. `alt: { type: 'string', … },`
  for (const m of src.slice(start).matchAll(/\n {4}([A-Za-z_]\w*):\s*\{[^\n]*\},/g)) {
    if (!out.includes(m[1])) out.push(m[1])
  }
  return [...new Set(out)]
}

/** The declared body of one property, for inspecting its type/group. */
function bodyOf(src, prop) {
  const re = new RegExp(`\\n {4}${prop}:\\s*\\{([\\s\\S]*?)\\n {4}\\},|\\n {4}${prop}:\\s*\\{([^\\n]*)\\},`)
  const m = src.match(re)
  return m?.[1] ?? m?.[2] ?? ''
}

/** The group a property declares, if any — used to skip non-visual ones. */
function groupOf(src, prop) {
  return bodyOf(src, prop).match(/group:\s*'([^']+)'/)?.[1] ?? null
}

/**
 * Every block component an adapter imports.
 *
 * Matched on the module path alone, not on the import clause. An earlier
 * version required the default import's identifier to be followed directly by
 * `from`, which missed
 *
 *     import QuoteBlock, { type QuoteStyleOptions } from '@/components/blocks/QuoteBlock'
 *
 * and reported OT_QuoteBlock as 0/3 while the component was calling
 * pa('quote') three times. A coverage tool that under-reports is worse than
 * none: it sends you to rewrite files that were already finished.
 *
 * Returns all matches, since several adapters split a block across two modules.
 */
/** True when a property is declared `type: 'array'`. */
function isArrayProp(src, prop) {
  return /type:\s*'array'/.test(bodyOf(src, prop))
}

function blocksFor(adapterSrc) {
  // Any component under components/, not just components/blocks/. An adapter
  // can hand its content to a shared presenter — OT_PractitionerProfile renders
  // through components/practitioner/PractitionerHeader — and scoping the search
  // to blocks/ reported it as 0/5 while the overlays were sitting in that file.
  return [...adapterSrc.matchAll(/from\s+'@\/components\/([\w./-]+)'/g)]
    .map(m => m[1])
}

const rows = []

for (const file of readdirSync(CONTENT_TYPES).sort()) {
  if (!file.endsWith('.ts')) continue
  const key = file.replace(/\.ts$/, '')
  const ctSrc = read(join(CONTENT_TYPES, file))

  // Only blocks — a component that can sit in a composition. Matched by regex
  // because the alignment of `baseType:` varies across these files, and a
  // literal " '_component'" silently skipped every file that pads it.
  if (!/baseType:\s*'_component'/.test(ctSrc)) continue

  // Third-party Forms elements are gated off entirely, and the theme/token
  // singletons are configuration rather than anything an editor sees on a page.
  if (key.startsWith('OptiForms')) continue
  if (key === 'OT_ThemeManager' || key === 'OT_TokenManager' || key === 'OT_TokenEntry') continue

  const adapterPath = join(ADAPTERS, `${key}.tsx`)
  if (!existsSync(adapterPath)) continue
  const adapterSrc = read(adapterPath)

  const blockNames = blocksFor(adapterSrc)
  // Both files, always. A server wrapper that delegates to `X.client.tsx` keeps
  // the props type in `X.tsx` and every render site in the client file, so
  // reading only the first one reports zero for a block that is fully done.
  const blockSrc = blockNames
    .flatMap(n => [read(join(COMPONENTS, `${n}.tsx`)), read(join(COMPONENTS, `${n}.client.tsx`))])
    .join('\n')
  const haystack = adapterSrc + '\n' + blockSrc

  const edited = new Set(
    // `pa?.('x')` as well as `pa('x')` — the optional form is what a component
    // uses when the factory is an optional prop, and requiring the bare call
    // reported PractitionerProfile as 0/4 with four overlays already in place.
    [...haystack.matchAll(/\bpa\??\.?\(\s*'([^']+)'\s*\)/g)].map(m => m[1]),
  )

  const props = propertiesOf(ctSrc).filter(p => {
    if (!isRenderedText(ctSrc, p)) return false
    // An array property renders as N elements. data-epi-edit names ONE
    // property and the CMS patches the element whose content is that property,
    // so there is nothing for it to point at. These update through the refetch
    // on save like any structural change. Counting them as missing would put a
    // ceiling on the metric and make it useless as a signal.
    if (isArrayProp(ctSrc, p)) return false
    const g = groupOf(ctSrc, p)
    return !(g && NON_VISUAL_GROUPS.has(g))
  })

  if (props.length === 0) continue

  const covered = props.filter(p => edited.has(p))
  const missing = props.filter(p => !edited.has(p))

  rows.push({
    contentType: key,
    block: blockNames.join(", ") || "(none)",
    total: props.length,
    covered: covered.length,
    missing,
    selectable: /pa\(\s*(content\.__composition|node|content)\s*\)/.test(haystack),
  })
}

const json = process.argv.includes('--json')
const details = process.argv.includes('--details')

if (json) {
  console.log(JSON.stringify(rows, null, 2))
  process.exit(0)
}

rows.sort((a, b) => (a.covered / a.total) - (b.covered / b.total) || b.total - a.total)

const done = rows.filter(r => r.missing.length === 0)
const partial = rows.filter(r => r.missing.length > 0 && r.covered > 0)
const none = rows.filter(r => r.covered === 0)

console.log(`\nEditable-property coverage — ${rows.length} blocks\n`)
console.log(`  complete : ${done.length}`)
console.log(`  partial  : ${partial.length}`)
console.log(`  none     : ${none.length}`)

const totalProps = rows.reduce((n, r) => n + r.total, 0)
const totalCov = rows.reduce((n, r) => n + r.covered, 0)
console.log(`\n  properties: ${totalCov}/${totalProps} carry data-epi-edit `
  + `(${Math.round((totalCov / totalProps) * 100)}%)\n`)

const notSelectable = rows.filter(r => !r.selectable)
if (notSelectable.length) {
  console.log(`  ⚠ no data-epi-block-id — not selectable at all: `
    + notSelectable.map(r => r.contentType).join(', ') + '\n')
}

for (const r of rows) {
  const bar = r.covered === r.total ? '✔' : r.covered === 0 ? '·' : '~'
  console.log(`  ${bar} ${r.contentType.padEnd(30)} ${String(r.covered).padStart(2)}/${String(r.total).padEnd(2)}`
    + (details && r.missing.length ? `   missing: ${r.missing.join(', ')}` : ''))
}

console.log('')
