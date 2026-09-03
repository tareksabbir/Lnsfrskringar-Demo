/**
 * Shared verification for inbound webhooks.
 *
 * CMP sends the secret you registered with the webhook in a `Callback-Secret`
 * header on every delivery, and expects the receiver to check it — that header
 * is the only thing separating a real CMP delivery from anyone who has guessed
 * the URL. See:
 *   https://docs.developers.optimizely.com/content-marketing-platform/reference/get-started
 *
 * These handlers FAIL CLOSED. An earlier version wrapped the check in
 * `if (expectedSecret)`, so a missing environment variable silently turned
 * verification off and left the endpoint open to the public internet — the one
 * failure mode you never want from a security control, because nothing about
 * the running system looks wrong. Refusing is loud, and loud is recoverable.
 */

/**
 * Constant-time string comparison. A plain `===` returns as soon as two bytes
 * differ, which leaks the length and a prefix of the secret to anyone able to
 * time the responses. The difference is small, but avoiding it is free.
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export type WebhookAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

/**
 * Verify a CMP webhook delivery against the configured callback secret.
 *
 * @param headers  the inbound request headers
 * @param envVar   name of the environment variable holding the shared secret
 * @param label    log prefix, e.g. "cmp-preview"
 */
export function verifyCallbackSecret(
  headers: Headers,
  envVar: string,
  label: string,
): WebhookAuthResult {
  const expected = process.env[envVar]

  if (!expected) {
    console.error(
      `[${label}] refused: ${envVar} is not set. Set it to the same secret `
      + 'registered on the CMP webhook and redeploy.',
    )
    return {
      ok: false,
      status: 503,
      error: `${envVar} is not configured — this webhook is disabled.`,
    }
  }

  // Header names are case-insensitive; CMP documents it as `Callback-Secret`.
  const provided = headers.get('callback-secret') || ''
  if (!provided || !timingSafeEqualString(provided, expected)) {
    console.warn(`[${label}] rejected webhook — callback-secret mismatch`)
    return { ok: false, status: 401, error: 'invalid callback secret' }
  }

  return { ok: true }
}
