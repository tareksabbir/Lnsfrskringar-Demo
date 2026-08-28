export type FormOption = { caption: string; value: string; checked: boolean }

export function parseOptions(raw: unknown): FormOption[] {
  let source: unknown = raw

  // Unwrap JSON string if the CMS returned it serialized
  if (typeof source === 'string') {
    try { source = JSON.parse(source) } catch { return [] }
  }

  // Handle Optimizely OptionListProperty's { items: [...] } envelope
  if (!Array.isArray(source) && Array.isArray((source as any)?.items)) {
    source = (source as any).items
  }

  if (!Array.isArray(source)) return []

  return (source as any[])
    .filter(o => typeof o?.caption === 'string')
    .map(o => ({
      caption: String(o.caption),
      value:   String(o.value ?? o.caption),
      checked: o.checked === true,
    }))
}
