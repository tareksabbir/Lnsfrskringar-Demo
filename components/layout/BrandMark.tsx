// Neutral, theme-following brand lockup shown when no CMS logo is configured.
// A brand-colored mark plus the site name: it adopts the active theme's brand
// color, so a fresh install reads as the configured site (default
// "Site Accelerator") rather than a baked-in identity. Once an editor uploads a
// logo via the ThemeManager, the logo image is used instead.
export function BrandMark({
  name,
  size = 'md',
  className = '',
}: {
  name: string
  size?: 'sm' | 'md' | 'lg'
  className?: string
}) {
  const MARK = { sm: 'h-5 w-5', md: 'h-7 w-7', lg: 'h-9 w-9' }
  const TEXT = { sm: 'text-[1.05rem]', md: 'text-[1.35rem]', lg: 'text-[1.7rem]' }
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <span aria-hidden className={`${MARK[size]} shrink-0 bg-brand rounded-ot-control`} />
      <span className={`${TEXT[size]} font-extrabold tracking-[-0.02em] leading-none whitespace-nowrap`}>
        {name}
      </span>
    </span>
  )
}
