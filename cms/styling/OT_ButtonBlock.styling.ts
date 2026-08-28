import type { ButtonBlockStyleOptions } from '@/components/blocks/ButtonBlock'

// CMS choice keys must be alphanumeric/underscore; map hoverFill back to the
// component's "hover-fill" variant key.
function normalizeVariant(v: unknown): ButtonBlockStyleOptions['variant'] {
  if (v === 'hoverFill') return 'hover-fill'
  return (v ?? 'brand') as ButtonBlockStyleOptions['variant']
}

export function getButtonStyles(s: Record<string, string | boolean>): ButtonBlockStyleOptions {
  return {
    variant:      normalizeVariant(s.variant),
    size:         (s.size         ?? 'md')        as ButtonBlockStyleOptions['size'],
    icon:         (s.icon         ?? 'none')      as ButtonBlockStyleOptions['icon'],
    iconPosition: (s.iconPosition ?? 'trailing')  as ButtonBlockStyleOptions['iconPosition'],
    alignment:    (s.alignment    ?? 'left')      as ButtonBlockStyleOptions['alignment'],
    fullWidth:    s.fullWidth === 'true' || s.fullWidth === true,
  }
}
