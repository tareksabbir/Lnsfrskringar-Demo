import ThemeToggle from '@/components/ui/ThemeToggle'
import MobileMenu from '@/components/layout/MobileMenu'
import MenuDrawer from '@/components/layout/MenuDrawer'
import UtilityNav from '@/components/layout/UtilityNav'
import { ICON_REGISTRY } from '@/components/icons/iconRegistry'
import { BrandMark } from '@/components/layout/BrandMark'
import { LogoImage } from '@/components/layout/LogoImage'
import { LocaleSelector } from '@/components/layout/LocaleSelector'
import type { NavItem } from '@/components/layout/DesktopNav'
import type { IconKey } from '@/components/icons/iconRegistry'

/** An icon + label action in the header's right-hand cluster. */
type HeaderAction = {
  label: string
  href:  string
  icon?: IconKey
}
import SearchTrigger from '@/components/search/SearchTrigger'
import { getSiteSettings, getRequestDomain, getRequestLocale } from '@/lib/optimizely'
import { getEnabledLanguages } from '@/lib/i18n/getEnabledLanguages'
import { t } from '@/lib/i18n/t'
import { localizedHref, stripLocalePrefix } from '@/lib/i18n/config'
import type { Locale } from '@/lib/i18n/config'

const FALLBACK_NAV: NavItem[] = [
  { label: 'Product',  href: '#' },
  { label: 'Pricing',  href: '#' },
  { label: 'About',    href: '#' },
  { label: 'Showcase', href: '/showcase' },
]

/**
 * Normalises a raw CMS link URL into a front-end-navigable href.
 *
 * Content Graph can return link URLs in several forms:
 *   - Relative path:          "/about"  → strip+re-apply locale prefix
 *   - Absolute same-domain:   "https://domain.com/showcase" → extract path, locale-prefix
 *   - Absolute external:      "https://other.com" → return unchanged
 *   - Unresolved content ref: "cms://content/{uuid}" → fall back to '#'
 *
 * All internal paths are run through localizedHref so nav links stay
 * locale-aware: on /es/* every link points to /es/... automatically.
 */
function normalizeNavHref(
  rawUrl: string | null | undefined,
  locale: Locale,
  domain: string,       // request Host header, e.g. "your-site.vercel.app"
): string {
  if (!rawUrl) return '#'

  // Unresolvable CMS internal reference — graceful fallback.
  if (rawUrl.startsWith('cms://')) return '#'

  let pathname: string

  if (rawUrl.startsWith('/')) {
    pathname = rawUrl
  } else if (rawUrl.startsWith('http')) {
    try {
      const linkUrl = new URL(rawUrl)
      // External URL — return unchanged so external links work normally.
      if (linkUrl.host !== domain) return rawUrl
      // Same-domain absolute URL → extract pathname for locale-prefixing.
      pathname = linkUrl.pathname
    } catch {
      return '#'
    }
  } else {
    return '#'
  }

  // Strip any locale prefix the CMS may have embedded, then re-apply for
  // the current request locale so links work correctly on /es/*, /fr/*, etc.
  return localizedHref(stripLocalePrefix(pathname), locale)
}

export default async function Header() {
  const domain   = await getRequestDomain()
  const locale   = await getRequestLocale()
  const settings = await getSiteSettings(domain, locale)

  const siteName       = (settings?.siteName as string | undefined) ?? 'Site Accelerator'
  const logoSrc        = settings?.logo?.url?.default
  const logoAlt        = settings?.logoAlt       ?? siteName
  const logoFit        = (settings?.logoFit as string | undefined) ?? 'full'
  const logoInvertDark = settings?.logoInvertDark === true
  const ctaLabel       = settings?.ctaLabel ?? 'Get Started'
  const ctaHref        = normalizeNavHref(settings?.ctaUrl?.default, locale, domain)

  // Container owns the sizing — image uses h-full w-auto so any asset format
  // (SVG with/without viewBox, PNG, WebP, any aspect ratio) scales correctly.
  const LOGO_CONTAINER_CLASS: Record<string, string> = {
    full:    'h-10 max-w-[200px] flex-shrink-0',
    icon:    'h-10 w-10 flex-shrink-0',
    compact: 'h-8 max-w-[160px] flex-shrink-0',
  }
  const logoContainerClass = LOGO_CONTAINER_CLASS[logoFit] ?? LOGO_CONTAINER_CLASS.full
  const logoImgClass = [
    'h-full w-auto max-w-full object-contain object-left',
    logoInvertDark ? 'logo-invert-dark' : '',
  ].filter(Boolean).join(' ')

  // Locale codes sourced from Graph (Content locale facets) rather than a manual
  // ThemeManager field — see lib/i18n/getEnabledLanguages.ts.
  const enabledLocales = await getEnabledLanguages()

  const navItems: NavItem[] = settings?.primaryNavigation?.length
    ? settings.primaryNavigation.map((item: any) => ({
        label:    item.menuLink?.text ?? '',
        href:     normalizeNavHref(item.menuLink?.url?.default, locale, domain),
        children: item.subNavItems?.length
          ? item.subNavItems.map((c: any) => ({
              label:       c.menuLink?.text ?? '',
              href:        normalizeNavHref(c.menuLink?.url?.default, locale, domain),
              description: c.description ?? undefined,
              icon:        c.icon && c.icon !== 'none' ? c.icon : undefined,
            }))
          : undefined,
      }))
    : FALLBACK_NAV

  // Slim persona/segment tabs above the main header (e.g. "Private" /
  // "Business & Agriculture"). Renders only when the editor has set at least
  // one item on OT_ThemeManager.utilityNav — otherwise the bar is entirely
  // absent, so this stays opt-in per site/theme.
  const utilityNavItems: NavItem[] = settings?.utilityNav?.length
    ? settings.utilityNav.map((item: any) => ({
        label: item.menuLink?.text ?? '',
        href:  normalizeNavHref(item.menuLink?.url?.default, locale, domain),
      }))
    : []

  // Icon + label actions in the header's right-hand cluster (e.g. "County",
  // "Log in"). Search and Menu are structural and sit after these.
  const headerActions: HeaderAction[] = settings?.headerActions?.length
    ? settings.headerActions.map((item: any) => ({
        label: item.menuLink?.text ?? '',
        href:  normalizeNavHref(item.menuLink?.url?.default, locale, domain),
        icon:  item.icon && item.icon !== 'none' ? item.icon : undefined,
      }))
    : []

  // Second group inside the Menu drawer. Flat links only — any sub-items an
  // editor sets are ignored, which the field description says.
  const menuShortcuts: NavItem[] = settings?.menuShortcuts?.length
    ? settings.menuShortcuts.map((item: any) => ({
        label: item.menuLink?.text ?? '',
        href:  normalizeNavHref(item.menuLink?.url?.default, locale, domain),
      }))
    : []


  return (
    <>
      {/* Skip to main content — accessibility */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-sm focus:left-sm focus:z-9999
                   focus:px-md focus:py-sm focus:bg-brand focus:text-fg-on-brand
                   focus:text-sm focus:font-semibold"
      >
        {t(locale, 'nav.skipToMain')}
      </a>

      <header className="sticky top-0 z-50 bg-canvas/80 backdrop-blur-md shadow-[0_1px_0_0_var(--ot-bloom-brand-border),0_8px_32px_0_var(--ot-bloom-brand-faint)]">

        {utilityNavItems.length > 0 && <UtilityNav items={utilityNavItems} />}

        <div className="ot-container flex items-center justify-between px-md py-md lg:px-lg">

          <a href={localizedHref('/', locale)} aria-label={`${logoAlt} — ${t(locale, 'nav.home')}`} className="flex items-center h-12">
            {logoSrc ? (
              <LogoImage
                src={logoSrc}
                alt={logoAlt}
                containerClass={logoContainerClass}
                imgClass={logoImgClass}
              />
            ) : (
              <BrandMark name={siteName} className="text-fg" />
            )}
          </a>

          {/* No inline nav on desktop — the primary navigation lives in the Menu
              drawer, matching the reference. DesktopNav is still used by other
              header shells (split-bar, sidebar), so it is not removed from the
              codebase, only from this one. */}
          <div className="hidden lg:flex items-center gap-x-7">
            {headerActions.map((action, i) => {
              const Icon = action.icon ? ICON_REGISTRY[action.icon] : undefined
              return (
                <a
                  key={`${action.label}-${i}`}
                  href={action.href}
                  className="flex items-center gap-2 text-sm font-semibold text-brand
                             hover:text-brand-hover transition-colors duration-150
                             focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
                >
                  {Icon && <Icon aria-hidden="true" className="h-5 w-5" />}
                  {action.label}
                </a>
              )
            })}
            {/* Labelled to sit as a peer of the CMS-driven actions rather than
                as loose chrome beside them. No ThemeToggle here: the reference
                header carries no mode switch, and the mode is the theme's
                decision via ThemeManager.defaultMode. The mobile row below keeps
                one, since that is the only place a visitor can reach it. */}
            <SearchTrigger showLabel />
            <LocaleSelector enabledLocales={enabledLocales} />
            <MenuDrawer navItems={navItems} shortcuts={menuShortcuts} />
          </div>

          <div className="lg:hidden flex items-center gap-sm">
            <SearchTrigger />
            <ThemeToggle />
            <MobileMenu navItems={navItems} ctaLabel={ctaLabel} ctaHref={ctaHref} enabledLocales={enabledLocales} />
          </div>

        </div>
      </header>
    </>
  )
}
