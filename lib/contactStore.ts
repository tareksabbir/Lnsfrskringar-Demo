/**
 * Where a contact-form submission goes.
 *
 * Vercel KV (Upstash REST) when configured, in-memory otherwise — the same
 * shape lib/cmpPreviewStore.ts uses, and the same caveat: the in-memory
 * fallback is fine for `yarn dev` and useless across serverless instances.
 *
 * ── This holds personal data, so it is built to hold as little as possible ──
 *
 *  - Everything expires. A demo has no reason to keep a stranger's email
 *    address for longer than someone needs to read it, and the shortest
 *    defensible retention is the one that needs no policy.
 *  - The IP is never stored, only a salted hash of it, and only to rate-limit.
 *    A hash answers "is this the same sender as a moment ago" without keeping
 *    anything that identifies who they are.
 *  - Nothing here is written into the CMS content tree. Content is published;
 *    a stranger's message is not content.
 *  - Values are never logged. The endpoint logs counts and outcomes.
 */

export type ContactSubmission = {
  id:        string
  receivedAt: string
  name:      string
  email:     string
  subject:   string
  message:   string
  /** Where the form was submitted from, for context in the admin list. */
  pagePath?: string
}

/** Thirty days. Long enough to act on, short enough to defend. */
const TTL_SECONDS = 30 * 24 * 60 * 60

/** Rate-limit window: how long one sender is held to the cap below. */
const RATE_WINDOW_SECONDS = 60 * 60
const RATE_MAX = 5

const LIST_KEY = 'contact:submissions'
const keyFor = (id: string) => `contact:submission:${id}`
const rateKeyFor = (hash: string) => `contact:rate:${hash}`

// ── KV ───────────────────────────────────────────────────────────────────────

function kvConfig(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url, token } : null
}

async function kv(args: (string | number)[]): Promise<unknown> {
  const cfg = kvConfig()
  if (!cfg) return null
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`KV ${String(args[0])} failed: ${res.status}`)
  const json = (await res.json()) as { result?: unknown }
  return json.result ?? null
}

// ── In-memory fallback ───────────────────────────────────────────────────────
// On globalThis so it survives dev HMR, exactly as cmpPreviewStore does.

type Mem = { items: ContactSubmission[]; rate: Map<string, { n: number; until: number }> }
const mem: Mem =
  ((globalThis as { __contactStore?: Mem }).__contactStore ??=
    { items: [], rate: new Map() })

export function contactStoreIsDurable(): boolean {
  return kvConfig() !== null
}

// ── Rate limiting ────────────────────────────────────────────────────────────

/**
 * @returns true when this sender is within the cap and may proceed.
 *
 * Fails OPEN on a KV error. A contact form that stops accepting messages
 * because a cache is briefly unreachable is a worse outcome than one that
 * briefly accepts too many, and the caps below are about abuse, not security.
 */
export async function allowSubmission(senderHash: string): Promise<boolean> {
  if (!kvConfig()) {
    const now = Date.now()
    const entry = mem.rate.get(senderHash)
    if (!entry || entry.until < now) {
      mem.rate.set(senderHash, { n: 1, until: now + RATE_WINDOW_SECONDS * 1000 })
      return true
    }
    entry.n += 1
    return entry.n <= RATE_MAX
  }

  try {
    const key = rateKeyFor(senderHash)
    const n = Number(await kv(['INCR', key]) ?? 1)
    if (n === 1) await kv(['EXPIRE', key, RATE_WINDOW_SECONDS])
    return n <= RATE_MAX
  } catch (err) {
    console.warn('[contact] rate-limit check failed, allowing:', err)
    return true
  }
}

// ── Read / write ─────────────────────────────────────────────────────────────

export async function saveSubmission(s: ContactSubmission): Promise<void> {
  if (!kvConfig()) {
    mem.items.unshift(s)
    mem.items = mem.items.slice(0, 200)
    return
  }
  await kv(['SET', keyFor(s.id), JSON.stringify(s), 'EX', TTL_SECONDS])
  await kv(['LPUSH', LIST_KEY, s.id])
  // The index is trimmed rather than expired: ids whose payload has aged out
  // are skipped on read, so a stale id costs nothing.
  await kv(['LTRIM', LIST_KEY, 0, 199])
}

export async function listSubmissions(limit = 50): Promise<ContactSubmission[]> {
  if (!kvConfig()) return mem.items.slice(0, limit)

  const ids = (await kv(['LRANGE', LIST_KEY, 0, limit - 1])) as string[] | null
  if (!ids?.length) return []

  const out: ContactSubmission[] = []
  for (const id of ids) {
    try {
      const raw = (await kv(['GET', keyFor(id)])) as string | null
      if (raw) out.push(JSON.parse(raw) as ContactSubmission)
    } catch {
      // A single unreadable entry must not hide the rest of the list.
    }
  }
  return out
}
