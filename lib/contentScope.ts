/** Application authorities used for published Graph content. Never query other sites as a fallback. */
export function graphSiteOrigins(requestBase?: string): string[] {
  const configured = process.env.CMS_GRAPH_SITE_ORIGINS?.split(',').map(s => s.trim()).filter(Boolean)
  if (configured?.length) {
    return [...new Set(configured.map(value => new URL(value).origin))]
  }
  const domain = process.env.NEXT_PUBLIC_SITE_DOMAIN?.trim()
  const source = domain || process.env.NEXT_PUBLIC_SITE_URL || requestBase
  if (!source) return []
  const url = new URL(source.includes('://') ? source : `https://${source}`)
  // HTTPS/HTTP aliases share an authority; retain the port for local CMS hosts.
  return [...new Set([url.origin, `https://${url.host}`, `http://${url.host}`])]
}

export function belongsToSite(base: unknown, requestBase?: string): boolean {
  if (typeof base !== 'string' || !base) return false
  try {
    return graphSiteOrigins(requestBase).includes(new URL(base).origin)
  } catch {
    return false
  }
}

/** Explicit per-deployment folder identity; missing configuration must not select another site's folder. */
export function blogContainerKey(): string | null {
  return process.env.CMS_BLOG_CONTAINER_KEY?.trim() || null
}
