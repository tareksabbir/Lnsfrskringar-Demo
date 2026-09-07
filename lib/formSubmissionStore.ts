// Durable store for Optimizely Forms submissions.
//
// Optimizely Forms does NOT keep submissions. The form container has a
// `SubmitUrl` property and the front end POSTs the collected fields there — the
// CMS is only the authoring surface. So the endpoint behind that URL, and the
// storage behind the endpoint, are ours to provide. This is that storage.
//
// Backed by Vercel KV / Upstash over their REST API, mirroring
// `lib/cmpPreviewStore.ts` so there is one KV idiom in the codebase rather than
// two. Falls back to an in-memory list (held on globalThis to survive dev HMR)
// when no KV env vars are present — fine for `yarn dev`, NOT durable on Vercel,
// where every request may land on a different lambda.
//
// Recognised env vars (either naming works):
//   KV_REST_API_URL        / KV_REST_API_TOKEN          (Vercel KV integration)
//   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN   (Upstash marketplace)

export type FormSubmission = {
  receivedAt: string
  /** Which form the fields came from, when the caller identifies it. */
  form?: string
  fields: Record<string, string>
}

const LIST_KEY = 'forms:submissions'
/** Newest-first, trimmed on every write so the list cannot grow without bound. */
const MAX_STORED = 500
const TTL_SECONDS = 60 * 60 * 24 * 90

function kvConfig(): { url: string; token: string } | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url, token } : null
}

async function kvCommand(args: (string | number)[]): Promise<unknown> {
  const cfg = kvConfig()
  if (!cfg) return null
  const res = await fetch(cfg.url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
    cache: 'no-store',
  })
  // The command name is safe to log; the arguments are not — a SET carries the
  // submission body, which is visitor-supplied personal data.
  if (!res.ok) throw new Error(`KV ${String(args[0])} failed: ${res.status}`)
  const json = (await res.json()) as { result?: unknown }
  return json.result ?? null
}

type MemStore = { list: FormSubmission[] }
const globalRef = globalThis as unknown as { __formSubmissionMemStore?: MemStore }
const mem: MemStore =
  globalRef.__formSubmissionMemStore ?? (globalRef.__formSubmissionMemStore = { list: [] })

export async function putSubmission(submission: FormSubmission): Promise<void> {
  if (kvConfig()) {
    await kvCommand(['LPUSH', LIST_KEY, JSON.stringify(submission)])
    await kvCommand(['LTRIM', LIST_KEY, 0, MAX_STORED - 1])
    await kvCommand(['EXPIRE', LIST_KEY, TTL_SECONDS])
    return
  }
  mem.list.unshift(submission)
  mem.list.length = Math.min(mem.list.length, MAX_STORED)
}

export async function listSubmissions(limit = 100): Promise<FormSubmission[]> {
  const n = Math.min(Math.max(1, Math.trunc(limit)), MAX_STORED)
  if (kvConfig()) {
    const raw = await kvCommand(['LRANGE', LIST_KEY, 0, n - 1])
    if (!Array.isArray(raw)) return []
    return raw.flatMap((entry) => {
      if (typeof entry !== 'string') return []
      try {
        return [JSON.parse(entry) as FormSubmission]
      } catch {
        return []
      }
    })
  }
  return mem.list.slice(0, n)
}

/** True when a durable KV backend is configured (vs. the in-memory fallback). */
export function submissionStoreIsDurable(): boolean {
  return kvConfig() !== null
}

/**
 * Fixed-window request counter, used by the submit endpoint to rate limit.
 * Returns the count for the current window. Without KV it counts in memory,
 * which on Vercel means per-lambda — weaker, but never weaker than nothing.
 */
const memWindows = new Map<string, { count: number; resetAt: number }>()

export async function bumpRateCounter(bucket: string, windowSeconds: number): Promise<number> {
  const key = `forms:rate:${bucket}`
  if (kvConfig()) {
    const count = await kvCommand(['INCR', key])
    // Set the TTL only on the first hit, so the window is fixed rather than
    // sliding forward on every request and never expiring.
    if (count === 1) await kvCommand(['EXPIRE', key, windowSeconds])
    return typeof count === 'number' ? count : 1
  }
  const now = Date.now()
  const cur = memWindows.get(key)
  if (!cur || cur.resetAt <= now) {
    memWindows.set(key, { count: 1, resetAt: now + windowSeconds * 1000 })
    return 1
  }
  cur.count += 1
  return cur.count
}
