export type PractitionerListingLayout  = 'grid' | 'list'
export type PractitionerListingColor   = 'canvas' | 'surface'
export type PractitionerListingColumns = 2 | 3 | 4
export type PractitionerListingDensity = 'comfortable' | 'compact'

export type PractitionerListingStyleOptions = {
  layout:      PractitionerListingLayout
  color:       PractitionerListingColor
  columns:     PractitionerListingColumns
  showSearchFilters: boolean
  density:     PractitionerListingDensity
}

// Display-template select editors return strings; the boolean toggles come
// through as the literal strings 'true' / 'false', and `columns` as the choice
// keys 'col2' | 'col3' | 'col4' (CMS requires choice keys ≥2 chars).
export function getPractitionerListingStyles(
  s: Record<string, string | boolean>,
): PractitionerListingStyleOptions {
  const bool = (v: string | boolean | undefined, fallback: boolean) =>
    v === undefined ? fallback : v === true || v === 'true'

  const colMap: Record<string, PractitionerListingColumns> = { col2: 2, col3: 3, col4: 4 }
  const columns = colMap[String(s.columns)] ?? 3

  return {
    layout:      (s.layout  ?? 'grid')        as PractitionerListingLayout,
    color:       (s.color   ?? 'canvas')      as PractitionerListingColor,
    columns,
    // One toggle hides both the search field and the filter chips. Default on.
    // Falls back to the legacy `showSearch` key so content authored before the
    // two settings were merged still resolves sensibly.
    showSearchFilters: bool(s.showSearchFilters ?? s.showSearch, true),
    density:     (s.density ?? 'comfortable') as PractitionerListingDensity,
  }
}
