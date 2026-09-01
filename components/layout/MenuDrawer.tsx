'use client'

import { useState, useEffect, useRef, useCallback, startTransition } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ICON_REGISTRY } from '@/components/icons/iconRegistry'
import type { NavItem } from '@/components/layout/DesktopNav'
import { useTranslation } from '@/lib/i18n/useTranslation'

/**
 * The desktop "Menu" drawer — a panel that slides in from the right, holding the
 * primary navigation and a secondary Shortcuts group.
 *
 * On this site the desktop header carries no inline nav links, so this drawer is
 * the ONLY way to reach the primary navigation on a large screen. That makes its
 * keyboard and screen-reader behaviour load-bearing rather than a nicety: it is a
 * modal dialog, so focus is trapped while open, Escape closes it, and focus
 * returns to the trigger on close.
 *
 * Below `lg` the header renders MobileMenu instead, which owns the small-screen
 * pattern; this component is hidden there rather than competing with it.
 */

type Props = {
  navItems:  NavItem[]
  shortcuts: NavItem[]
}

/** Selector for everything that can hold focus inside the panel. */
const FOCUSABLE =
  'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'

function matchHref(pathname: string, href: string) {
  if (!href || href === '#') return { exact: false, section: false }
  let path = href
  if (href.startsWith('http')) {
    try { path = new URL(href).pathname } catch { return { exact: false, section: false } }
  }
  const normPath     = path     === '/' ? path     : path.replace(/\/$/, '')
  const normPathname = pathname === '/' ? pathname : pathname.replace(/\/$/, '')
  const exact   = normPathname === normPath
  const section = exact || (normPath !== '/' && normPathname.startsWith(`${normPath}/`))
  return { exact, section }
}

export default function MenuDrawer({ navItems, shortcuts }: Props) {
  const [open,        setOpen]        = useState(false)
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null)
  const [mounted,     setMounted]     = useState(false)

  const panelRef   = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)

  const pathname = usePathname()
  const { t } = useTranslation()

  useEffect(() => { startTransition(() => setMounted(true)) }, [])

  const close = useCallback(() => {
    setOpen(false)
    setExpandedIdx(null)
  }, [])

  // Close on route change. Every link inside already closes on click, so this
  // only catches navigations that bypass them — browser back/forward while the
  // drawer is open. Guarded on an actual path change rather than running on
  // mount and on every render, which would set state during a commit for no
  // reason and cascade a second render each time.
  const prevPath = useRef(pathname)
  useEffect(() => {
    if (prevPath.current === pathname) return
    prevPath.current = pathname
    close()
  }, [pathname, close])

  // Modal behaviour: scroll lock, Escape, and a focus trap.
  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    // Captured now, not read in cleanup: by the time cleanup runs the ref may
    // point at a different node (or null), and focus would go nowhere.
    const trigger = triggerRef.current

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') { close(); return }
      if (e.key !== 'Tab') return

      const nodes = panelRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (!nodes?.length) return
      const first = nodes[0]
      const last  = nodes[nodes.length - 1]

      // Wrap at both ends so Tab can never reach the page behind the overlay.
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    // Move focus into the panel so a keyboard user is not left behind the overlay.
    panelRef.current?.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.body.style.overflow = prevOverflow
      // Return focus to the trigger, not to wherever the browser decides.
      ;(trigger ?? previouslyFocused)?.focus()
    }
  }, [open, close])

  const ChevronRight = ICON_REGISTRY['chevronRight']

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="hidden lg:flex items-center gap-2 text-sm font-semibold text-brand
                   hover:text-brand-hover transition-colors duration-150
                   focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
      >
        <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="none"
             stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        {t('nav.menu')}
      </button>

      {mounted && createPortal(
        <div
          className={`hidden lg:block fixed inset-0 z-[200] ${open ? '' : 'pointer-events-none'}`}
          aria-hidden={!open}
        >
          {/* Overlay. Non-interactive scrim — the close affordances are the X,
              Escape, and this click target. */}
          <button
            type="button"
            tabIndex={-1}
            aria-label={t('nav.closeMenu')}
            onClick={close}
            className={`absolute inset-0 w-full cursor-default bg-brand/45 backdrop-blur-[1px]
                        transition-opacity duration-300 ease-quick motion-reduce:transition-none
                        ${open ? 'opacity-100' : 'opacity-0'}`}
          />

          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={t('nav.menu')}
            className={`absolute inset-y-0 right-0 flex w-full max-w-[32rem] flex-col
                        overflow-y-auto bg-surface shadow-[0_0_60px_0_var(--ot-bloom-brand-faint)]
                        transition-transform duration-300 ease-quick motion-reduce:transition-none
                        ${open ? 'translate-x-0' : 'translate-x-full'}`}
          >
            <div className="flex justify-end p-md">
              <button
                type="button"
                onClick={close}
                aria-label={t('nav.closeMenu')}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-tint
                           text-brand transition-colors duration-150 hover:bg-brand hover:text-fg-on-brand
                           focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4" fill="none"
                     stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="5" y1="5" x2="19" y2="19" />
                  <line x1="19" y1="5" x2="5" y2="19" />
                </svg>
              </button>
            </div>

            <nav aria-label={t('nav.menu')} className="px-lg pb-xl">
              <h2 className="text-xl font-bold text-brand">{t('nav.menu')}</h2>

              <ul className="mt-md">
                {navItems.map((item, i) => {
                  const hasChildren = !!item.children?.length
                  const isExpanded  = expandedIdx === i
                  const self        = matchHref(pathname, item.href)
                  const active      = hasChildren
                    ? item.children!.some(c => matchHref(pathname, c.href).section)
                    : self.section

                  return (
                    <li key={`${item.label}-${i}`} className="border-b border-border">
                      {hasChildren ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setExpandedIdx(v => (v === i ? null : i))}
                            aria-expanded={isExpanded}
                            className="flex w-full items-center justify-between gap-sm py-4 text-left
                                       text-base text-fg transition-colors duration-150 hover:text-brand
                                       focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
                          >
                            <span className={active ? 'font-semibold text-brand' : ''}>{item.label}</span>
                            {ChevronRight && (
                              <ChevronRight
                                aria-hidden="true"
                                className={`h-5 w-5 shrink-0 text-brand transition-transform duration-200
                                            ease-quick motion-reduce:transition-none
                                            ${isExpanded ? 'rotate-90' : ''}`}
                              />
                            )}
                          </button>

                          {isExpanded && (
                            <ul className="pb-3 pl-4">
                              {item.children!.map((child, j) => (
                                <li key={`${child.label}-${j}`}>
                                  <Link
                                    href={child.href}
                                    onClick={close}
                                    aria-current={matchHref(pathname, child.href).exact ? 'page' : undefined}
                                    className="block py-2.5 text-sm text-fg-muted transition-colors
                                               duration-150 hover:text-brand
                                               focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
                                  >
                                    {child.label}
                                  </Link>
                                </li>
                              ))}
                            </ul>
                          )}
                        </>
                      ) : (
                        <Link
                          href={item.href}
                          onClick={close}
                          aria-current={self.exact ? 'page' : undefined}
                          className={`block py-4 text-base transition-colors duration-150 hover:text-brand
                                      focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand
                                      ${active ? 'font-semibold text-brand' : 'text-fg'}`}
                        >
                          {item.label}
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>

              {shortcuts.length > 0 && (
                <>
                  <h2 className="mt-xl text-xl font-bold text-brand">{t('nav.shortcuts')}</h2>
                  <ul className="mt-md">
                    {shortcuts.map((item, i) => (
                      <li key={`${item.label}-${i}`} className="border-b border-border">
                        <Link
                          href={item.href}
                          onClick={close}
                          aria-current={matchHref(pathname, item.href).exact ? 'page' : undefined}
                          className="block py-4 text-base text-fg transition-colors duration-150
                                     hover:text-brand
                                     focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand"
                        >
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </nav>
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
