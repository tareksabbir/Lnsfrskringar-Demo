'use client'

import { Search } from 'lucide-react'
import { useSearch } from './SearchProvider'
import { useTranslation } from '@/lib/i18n/useTranslation'

type Props = {
  /**
   * Show the "Search" label beside the icon, matching the sibling header
   * actions (County, Log in, Menu). Off by default so the icon-only call sites —
   * the mobile row, the split header, the sidebar — are unaffected.
   */
  showLabel?: boolean
}

export default function SearchTrigger({ showLabel = false }: Props) {
  const { openSearch } = useSearch()
  const { t } = useTranslation()

  // The label is the accessible name when it is visible, so aria-label is
  // dropped in that case — leaving both would override the visible text with a
  // duplicate and break "activate what you see".
  const label = t('search.trigger')

  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label={showLabel ? undefined : label}
      className={[
        'flex items-center',
        showLabel
          ? 'gap-2 text-sm font-semibold text-brand hover:text-brand-hover focus-visible:outline-offset-4'
          : 'justify-center w-9 h-9 text-fg hover:text-brand focus-visible:outline-offset-2',
        'transition-colors duration-150 ease-quick',
        'focus-visible:outline-2 focus-visible:outline-brand',
      ].join(' ')}
    >
      <Search size={20} aria-hidden="true" />
      {showLabel && label}
    </button>
  )
}
