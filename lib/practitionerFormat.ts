import type { PractitionerData, PracticeAreaData } from '@/lib/practitioners'

// Pure presentation helpers shared by the practitioner header, card, row, and
// directory client. No CMS-SDK imports — safe to use in client components.

/** "Elena" + "Vargas" → "EV". Single name → first two letters. Empty → "". */
export function practitionerInitials(p: Pick<PractitionerData, 'firstName' | 'lastName'>): string {
  const f = (p.firstName ?? '').trim()
  const l = (p.lastName ?? '').trim()
  if (f && l) return (f[0] + l[0]).toUpperCase()
  const single = (f || l)
  return single ? single.slice(0, 2).toUpperCase() : ''
}

/** Full display name, optionally with the post-nominal suffix: "Elena Vargas, MD". */
export function practitionerName(
  p: Pick<PractitionerData, 'firstName' | 'lastName' | 'suffix'>,
  withSuffix = false,
): string {
  const name = [p.firstName, p.lastName].filter(Boolean).join(' ').trim()
  if (withSuffix && p.suffix) return `${name}, ${p.suffix}`
  return name
}

/** The flagged primary area, else the first area, else null. */
export function primaryArea(areas: PracticeAreaData[] | undefined): PracticeAreaData | null {
  if (!areas || areas.length === 0) return null
  return areas.find(a => a.isPrimary) ?? areas[0]
}

/** Strips HTML, collapses whitespace, truncates at a word boundary with an ellipsis. */
export function bioPreview(bio: { html: string } | undefined, max = 200): string {
  const html = bio?.html
  if (!html) return ''
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  if (text.length <= max) return text
  const slice = text.slice(0, max)
  const lastSpace = slice.lastIndexOf(' ')
  return (lastSpace > max * 0.6 ? slice.slice(0, lastSpace) : slice).trimEnd() + '…'
}

/** Parses the comma-separated `languages` field into a clean, de-duplicated list. */
export function parseLanguages(languages: string | undefined): string[] {
  if (!languages) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of languages.split(',')) {
    const v = raw.trim()
    if (!v) continue
    const k = v.toLowerCase()
    if (seen.has(k)) continue
    seen.add(k)
    out.push(v)
  }
  return out
}
