/**
 * next-intl routing configuration.
 *
 * Supported locales and the default locale are imported from
 * lib/i18n/config.ts so proxy and next-intl cannot drift apart.
 *
 * localePrefix: 'as-needed'
 *   Default locale (English) uses no URL prefix → /about
 *   Non-default locales use a prefix              → /fr/about, /es/about
 *   This matches the previous custom-middleware behaviour and ensures existing
 *   English URLs are never broken.
 *
 * Adding a new language:
 *   1. Add the locale code to SUPPORTED_LOCALES in lib/i18n/config.ts.
 *   2. Add its display name to LOCALE_META in the same file.
 *   3. Optionally add a message file at lib/i18n/messages/<locale>.json.
 *   4. Publish content in the new language in Optimizely CMS.
 *   The language switcher updates automatically via getEnabledLanguages().
 */

import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@/lib/i18n/config'
import { defineRouting } from 'next-intl/routing'

export const routing = defineRouting({
  locales: SUPPORTED_LOCALES,
  defaultLocale: DEFAULT_LOCALE,

  // Default locale uses no URL prefix; all others are prefixed.
  localePrefix: 'as-needed',

  // Keep locale detection enabled (the default) so the middleware correctly
  // rewrites locale-prefixed paths (/es/page → /page internally) and sets the
  // locale context. Disabling it was causing the middleware to skip URL rewrites
  // on Vercel, routing /es → /[...slug] instead of the home page.
  //
  // The "redirect back to /es" problem when switching to English is handled
  // differently: LocaleSelector now writes the NEXT_LOCALE cookie before
  // navigating, so the middleware sees the correct locale immediately and
  // doesn't redirect based on a stale cookie.
})

export type Locale = (typeof routing.locales)[number]
