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
const BLOCKS = join(ROOT, 'components/blocks')

/**
 * Property groups that never render visible text, so an overlay on them would
 * be meaningless. Everything else is fair game.
 */
const NON_VISUAL_GROUPS = new Set(['OT_SEO', 'OT_Integrations', 'OT_Theme'])

/** Properties that are configuration rather than content. */
const NON_VISUAL_NAMES = new Set([
  'headingLevel', 'headerEffect', 'treatment', 'intent', 'style', 'variant',
  'mediaSide', 'imageSide', 'topicFilter', 'pageSize', 'articleRoot',
  'enableExternalPreview', 'noIndex', 'FxFlagKey', 'siteKey',
])

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

/** The group a property declares, if any — used to skip non-visual ones. */
function groupOf(src, prop) {
  const re = new RegExp(`\\n {4}${prop}:\\s*\\{([\\s\\S]*?)\\n {4}\\},|\\n {4}${prop}:\\s*\\{([^\\n]*)\\},`)
  const m = src.match(re)
  const body = (m?.[1] ?? m?.[2] ?? '')
  return body.match(/group:\s*'([^']+)'/)?.[1] ?? null
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
function blocksFor(adapterSrc) {
  return [...adapterSrc.matchAll(/from\s+'@\/components\/blocks\/([\w./]+)'/g)]
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
  const blockSrc = blockNames
    .map(n => read(join(BLOCKS, `${n}.tsx`)) || read(join(BLOCKS, `${n}.client.tsx`)))
    .join('\n')
  const haystack = adapterSrc + '\n' + blockSrc

  const edited = new Set(
    [...haystack.matchAll(/\bpa\(\s*'([^']+)'\s*\)/g)].map(m => m[1]),
  )

  const props = propertiesOf(ctSrc).filter(p => {
    if (NON_VISUAL_NAMES.has(p)) return false
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
