'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { stripLocalePrefix } from '@/lib/i18n/config'
import type { NavItem } from '@/components/layout/DesktopNav'

/**
 * The slim persona switch above the main header — "Private" /
 * "Business & Agriculture" in the LF reference.
 *
 * A client component purely so it can read the current path. Header is an async
 * server component and there is no middleware putting the pathname on a request
 * header, so the active tab cannot be resolved server-side. Everything else here
 * is static markup.
 *
 * Right-aligned to match the reference: the persona switch is a secondary
 * wayfinding control, so it sits opposite the logo rather than leading the page.
 */

type Props = {
  items: NavItem[]
}

export default function UtilityNav({ items }: Props) {
  const pathname = usePathname()
  const currentPath = stripLocalePrefix(pathname || '/')

  // Longest match wins, so "/business/agriculture" picks the agriculture tab over
  // a broader "/business" one. Falls back to the first tab: these are personas
  // rather than pages, and the private site is the root, so "nothing selected" is
  // never the right resting state.
  const activeIdx = (() => {
    let best = -1
    let bestLen = 0
    items.forEach((item, i) => {
      const target = stripLocalePrefix(item.href || '')
      if (!target || target === '/' || target === '#') return
      if (currentPath === target || currentPath.startsWith(`${target}/`)) {
        if (target.length > bestLen) { best = i; bestLen = target.length }
      }
    })
    return best === -1 ? 0 : best
  })()

  return (
    <div data-theme="dark" className="bg-brand-hover">
      <nav
        aria-label="Utility navigation"
        className="ot-container hidden lg:flex items-stretch justify-end px-md lg:px-lg h-9"
      >
        {items.map((item, i) => {
          const active = i === activeIdx
          return (
            <Link
              key={`${item.label}-${i}`}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={`flex items-center px-4 text-[0.8125rem] transition-colors duration-150
                          focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-fg-on-brand
                          ${active
                            // The red rule is the accent's one job in the header —
                            // an inset shadow rather than a border so the tab keeps
                            // its full height and nothing shifts on state change.
                            ? 'bg-brand font-semibold text-fg-on-brand shadow-[inset_0_-3px_0_0_var(--ot-accent)]'
                            : 'font-medium text-fg-on-brand/75 hover:text-fg-on-brand'}`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
