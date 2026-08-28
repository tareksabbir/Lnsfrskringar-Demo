'use client'

/**
 * useTranslation — client-side translation hook.
 *
 * Reads the active locale from LocaleContext and returns a `t()` function
 * with the same signature as the server-side helper, so components can
 * be written identically regardless of whether they're server or client.
 *
 * Usage:
 *   const { t } = useTranslation()
 *   const label = t('nav.openMenu')
 *   const msg   = t('forms.fieldRequired', { field: 'Email' })
 */

import { useLocale } from './LocaleProvider'
import { t as serverT } from './t'
import type { MessageKey } from './t'

export function useTranslation() {
  const locale = useLocale()

  function t(key: MessageKey, vars?: Record<string, string | number>): string {
    return serverT(locale, key, vars)
  }

  return { t, locale }
}
