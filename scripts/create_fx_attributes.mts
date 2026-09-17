/**
 * Creates this app's FX user attributes in an Optimizely Feature Experimentation
 * project, so they can be picked from the audience-condition dropdowns.
 *
 * The attribute list is NOT defined here — it is imported from
 * lib/fx/identity.ts, the same module the app sends attributes from. That is the
 * point of the script: an attribute created by hand in the FX UI and an
 * attribute sent by the app must agree on the key exactly and case-sensitively,
 * and when they do not, FX raises no error. The audience simply never matches,
 * which looks precisely like "the experiment isn't running". Generating one from
 * the other removes the chance to typo it.
 *
 * Usage (tsx, like the repo's other .mts scripts — it imports a TS module, so
 * plain `node` cannot run it):
 *   OPTIMIZELY_REST_API_TOKEN=<token> npx tsx scripts/create_fx_attributes.mts [--project <id>] [--dry-run]
 *
 * The token is a personal access token from Optimizely (Profile → API Access).
 * It is NOT the SDK key, and not the CMS client id/secret. With the token in
 * .env.local instead:
 *   set -a && . ./.env.local && set +a && npx tsx scripts/create_fx_attributes.mts
 *
 * Idempotent: existing attributes with the same key are left alone and reported
 * as skipped, so re-running after adding a fifth attribute creates only that one.
 */
import { FX_ATTRIBUTE_SPECS } from '../lib/fx/identity'

const BASE = 'https://api.optimizely.com/v2'

/** Only the fields this script reads; the API returns a good deal more. */
type FxProject = { id: number; name: string; platform?: string; status?: string }
type FxAttribute = { id: number; key: string; name?: string }

const argv = process.argv.slice(2)
const flag = (name: string): string | undefined => {
  const i = argv.indexOf(name)
  return i === -1 ? undefined : argv[i + 1]
}
const DRY = argv.includes('--dry-run')

const token = process.env.OPTIMIZELY_REST_API_TOKEN
if (!token) {
  console.error(
    '\n✖ OPTIMIZELY_REST_API_TOKEN is not set.\n'
    + '  Create a personal access token in Optimizely (Profile → API Access) and either\n'
    + '  export it, or put it in .env.local and run:\n'
    + '    set -a && . ./.env.local && set +a && npx tsx scripts/create_fx_attributes.mts\n',
  )
  process.exit(1)
}

async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  })
  const text = await res.text()
  let body: unknown = text
  try { body = JSON.parse(text) } catch { /* leave as text */ }
  if (!res.ok) {
    const hint = res.status === 401 ? ' (token missing or malformed)'
      : res.status === 403 ? ' (token not authorised for this project)'
      : ''
    throw new Error(`${init.method ?? 'GET'} ${path} → ${res.status}${hint}: ${String(text).slice(0, 300)}`)
  }
  return body as T
}

/**
 * Resolve the project to write to.
 *
 * Passed explicitly, or inferred when the account has exactly one FX project —
 * inferring past that point would be guessing which customer's project to
 * modify, so it stops and lists them instead.
 */
async function resolveProjectId(): Promise<string> {
  const explicit = flag('--project')
  if (explicit) return explicit

  const projects = await api<FxProject[]>('/projects?per_page=100')
  const fx = projects.filter(p => p.platform === 'custom' || p.status === 'active')
  if (fx.length === 1) return String(fx[0].id)

  console.error('\n✖ Several projects are visible; pass one explicitly with --project <id>:')
  for (const p of fx) console.error(`    ${p.id}  ${p.name}  (${p.platform ?? '?'})`)
  process.exit(1)
}

const projectId = await resolveProjectId()
console.log(`› project ${projectId}${DRY ? '  (dry run — nothing will be written)' : ''}`)

const existing = await api<FxAttribute[]>(
  `/attributes?project_id=${encodeURIComponent(projectId)}&per_page=100`,
)
const byKey = new Map(existing.map(a => [a.key, a]))


let created = 0, skipped = 0
for (const spec of FX_ATTRIBUTE_SPECS) {
  if (byKey.has(spec.key)) {
    console.log(`  = ${spec.key.padEnd(16)} already exists (id ${byKey.get(spec.key)!.id})`)
    skipped++
    continue
  }

  // The API models every attribute as a string key; the value's type is decided
  // by what the SDK sends at decision time, not declared here. The permitted
  // values are spelled out in the description so whoever builds the audience can
  // see them without reading this repo.
  const permitted = spec.type === 'select'
    ? `One of: ${spec.options.map(o => o.value).join(', ')}.`
    : spec.type === 'number'
      ? `Number, ${spec.min}–${spec.max}.`
      : 'Boolean: true or false.'

  if (DRY) {
    console.log(`  + ${spec.key.padEnd(16)} would create — "${spec.label}"`)
    created++
    continue
  }

  const made = await api<FxAttribute>('/attributes', {
    method: 'POST',
    body: JSON.stringify({
      project_id: Number(projectId),
      key: spec.key,
      name: spec.label,
      description: `${spec.description} ${permitted}`,
    }),
  })
  console.log(`  + ${spec.key.padEnd(16)} created (id ${made.id})`)
  created++
}

console.log(`\n${DRY ? 'Would create' : 'Created'} ${created}, skipped ${skipped}.`)
if (!DRY && created > 0) {
  console.log(
    'Attributes appear in the audience-condition dropdown immediately, but a running\n'
    + "experiment's datafile is only reissued when you next save it — the panel in the\n"
    + 'site menu is sending these already either way.',
  )
}
