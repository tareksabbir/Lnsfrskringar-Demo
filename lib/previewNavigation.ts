/** Build navigation solely from the CMS contentSaved message, never stale URL parameters. */
export function previewNavigation(
  message: { previewUrl?: unknown; previewToken?: unknown },
  currentUrl: string,
): string | null {
  if (typeof message.previewUrl !== 'string') return null
  try {
    const current = new URL(currentUrl)
    const next = new URL(message.previewUrl, current.origin)
    if (next.origin !== current.origin) return null
    if (typeof message.previewToken === 'string' && message.previewToken) {
      next.searchParams.set('preview_token', message.previewToken)
    }
    // Incomplete events must not be repaired with an old version or token.
    if (!['key', 'ver', 'loc', 'preview_token'].every(key => next.searchParams.get(key))) return null
    return next.pathname + next.search + next.hash
  } catch {
    return null
  }
}
