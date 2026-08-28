'use client'

import { Search } from 'lucide-react'
import { useSearch } from './SearchProvider'
import { useTranslation } from '@/lib/i18n/useTranslation'

export default function SearchTrigger() {
  const { openSearch } = useSearch()
  const { t } = useTranslation()

  return (
    <button
      type="button"
      onClick={openSearch}
      aria-label={t('search.trigger')}
      className={[
        'flex items-center justify-center w-9 h-9',
        'text-fg hover:text-brand',
        'transition-colors duration-150 ease-quick',
        'focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2',
      ].join(' ')}
    >
      <Search size={20} aria-hidden="true" />
    </button>
  )
}
