export type DividerStyle    = 'mark' | 'glow' | 'bleed'
export type DividerSpace    = 'sm' | 'md' | 'lg' | 'xl'
export type DividerTone     = 'neutral' | 'brand' | 'accent' | 'spectrum' | 'aurora'
export type DividerOrnament = 'none' | 'pendant' | 'asterism' | 'dot'
export type DividerWeight   = 'slim' | 'bold'
export type DividerReveal   = 'static' | 'draw'

export type DividerStyleOptions = {
  style:    DividerStyle
  space:    DividerSpace
  tone:     DividerTone
  ornament: DividerOrnament
  weight:   DividerWeight
  reveal:   DividerReveal
}

const KNOWN_STYLES = new Set<DividerStyle>(['mark', 'glow', 'bleed'])

export function getDividerStyles(s: Record<string, string | boolean>): DividerStyleOptions {
  // Unknown / legacy style values (e.g. the removed 'prism') fall back to 'mark'.
  const rawStyle = String(s.style ?? 'mark')
  const style = (KNOWN_STYLES.has(rawStyle as DividerStyle) ? rawStyle : 'mark') as DividerStyle

  return {
    style,
    space:    (s.space    ?? 'lg')      as DividerSpace,
    tone:     (s.tone     ?? 'neutral') as DividerTone,
    ornament: (s.ornament ?? 'pendant') as DividerOrnament,
    weight:   (s.weight   ?? 'slim')    as DividerWeight,
    reveal:   (s.reveal   ?? 'static')  as DividerReveal,
  }
}
