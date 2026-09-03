import type { NextRequest } from 'next/server'
import { timingSafeEqualString } from '@/lib/webhookAuth'

/**
 * Bearer check shared by every /api/opal/* tool.
 *
 * Extracted so a second tool cannot drift from the first. Everything here was
 * learned by watching real Opal requests fail:
 *
 *   - The scheme is case-insensitive (RFC 7235). `startsWith('Bearer ')`
 *     rejected a legal "bearer …" and produced a 401 that looked exactly like
 *     a wrong secret.
 *   - A bare value with no scheme is accepted. Some callers put the raw token
 *     in the header; refusing it buys nothing, since the value still has to
 *     equal the secret.
 *   - Both sides are trimmed. A secret pasted into a dashboard picks up a
 *     trailing newline routinely, and neither UI shows it.
 *
 * Fails CLOSED: no OPAL_TOOL_SECRET means the endpoint refuses everything
 * rather than running open to whoever finds the URL.
 */

export type OpalAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

export function authorizeOpal(req: NextRequest, label: string): OpalAuthResult {
  const secret = (process.env.OPAL_TOOL_SECRET || '').trim()
  if (!secret) {
    console.error(`[${label}] 503: OPAL_TOOL_SECRET is not set — endpoint disabled.`)
    return { ok: false, status: 503, error: 'OPAL_TOOL_SECRET is not set — this endpoint is disabled.' }
  }

  const header = (req.headers.get('authorization') || '').trim()
  const match = /^bearer\s+(.+)$/i.exec(header)
  const token = (match ? match[1] : header).trim()

  if (!token) {
    // Header NAMES only, never values — enough to see whether the caller sent
    // its token somewhere unexpected, without writing a credential to a log.
    console.warn(
      `[${label}] 401: no Authorization header. Headers received: `
      + [...req.headers.keys()].sort().join(', '),
    )
    return { ok: false, status: 401, error: 'Unauthorized.' }
  }

  if (!timingSafeEqualString(token, secret)) {
    console.warn(
      `[${label}] 401: bearer token did not match OPAL_TOOL_SECRET `
      + `(sent ${token.length} chars, expected ${secret.length}).`,
    )
    return { ok: false, status: 401, error: 'Unauthorized.' }
  }

  return { ok: true }
}

/**
 * Opal wraps a tool's arguments rather than posting them at the root:
 *
 *     { "parameters": { … }, "auth": { … } }
 *
 * curl and scripts post flat. Both are accepted so neither caller has to know
 * about the other. `auth` is ignored — these tools authenticate on the
 * Authorization header, not on forwarded credentials.
 */
export function unwrapOpalParameters(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return null
  const root = body as Record<string, unknown>
  const p = root.parameters
  if (p && typeof p === 'object' && !Array.isArray(p)) return p as Record<string, unknown>
  return root
}
