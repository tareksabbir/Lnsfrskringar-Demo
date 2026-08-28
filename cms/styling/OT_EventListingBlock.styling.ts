export type EventListingView     = 'card' | 'list' | 'calendar'
export type EventListingColor    = 'canvas' | 'surface'
export type EventListingPastMode = 'hide' | 'show' | 'toggle'

export type EventListingStyleOptions = {
  defaultView:    EventListingView
  color:          EventListingColor
  showViewToggle: boolean
  showTypeFilter: boolean
  showPastEvents: EventListingPastMode
}

// Display-template select editors return strings; the boolean toggles come
// through as the literal strings 'true' / 'false'.
export function getEventListingStyles(s: Record<string, string | boolean>): EventListingStyleOptions {
  const bool = (v: string | boolean | undefined, fallback: boolean) =>
    v === undefined ? fallback : v === true || v === 'true'

  return {
    defaultView:    (s.defaultView    ?? 'card')   as EventListingView,
    color:          (s.color          ?? 'canvas') as EventListingColor,
    showViewToggle: bool(s.showViewToggle, true),
    showTypeFilter: bool(s.showTypeFilter, true),
    showPastEvents: (s.showPastEvents ?? 'toggle') as EventListingPastMode,
  }
}
