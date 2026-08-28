'use client'

/**
 * LocaleProvider — injects the active locale into React context for client components.
 *
 * Rendered in app/(site)/layout.tsx wrapping all site children.
 * The locale value is resolved server-side (from the URL / cookie) and passed
 * as a prop, keeping the provider itself a thin client boundary.
 */

import { createContext, useContext } from 'react'
import type { Locale } from './config'
import { DEFAULT_LOCALE } from './config'

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE)

export function LocaleProvider({
  locale,
  children,
}: {
  locale: Locale
  children: React.ReactNode
}) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

/** Returns the active locale for use in client components. */
export function useLocale(): Locale {
  return useContext(LocaleContext)
}
