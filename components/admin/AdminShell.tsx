import AdminNav from './AdminNav'
import LogoutButton from './LogoutButton'
import AdminHeaderTitle from './AdminHeaderTitle'
import { getSiteSettings, getRequestDomain, getRequestLocale, getRequestBaseUrl } from '@/lib/optimizely'

export default async function AdminShell({ children }: { children: React.ReactNode }) {
  const domain   = await getRequestDomain()
  const locale   = await getRequestLocale()
  const settings = await getSiteSettings(domain, locale)
  const siteName = (settings?.siteName as string | undefined) ?? 'Site Accelerator'
  const baseUrl  = await getRequestBaseUrl()
  const hostname = baseUrl ? baseUrl.replace(/^https?:\/\//, '') : domain

  return (
    <div className="flex h-full min-h-screen">
      {/* ── Sidebar ─────────────────────────────────────────────────────────── */}
      <aside className="oa-sidebar w-[220px] shrink-0 flex flex-col border-r">
        {/* Wordmark */}
        <div className="oa-wordmark-border h-[58px] flex items-center px-md border-b shrink-0 min-w-0">
          <span
            className="font-medium leading-none"
            style={{ color: 'oklch(from var(--ot-brand) 80% 0.14 h)' }}
          >
            Admin
          </span>
        </div>

        {/* Navigation */}
        <AdminNav />

        {/* Sign out */}
        <div className="oa-sb-divider shrink-0 border-t">
          <LogoutButton />
        </div>
      </aside>

      {/* ── Main ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="oa-topbar h-[58px] shrink-0 flex items-center justify-between px-lg bg-canvas relative z-10">
          {/* Page title — resolved client-side from route */}
          <AdminHeaderTitle />

          {/* Site context */}
          <div className="flex items-center gap-sm">
            <span className="text-[0.6875rem] font-medium text-fg-muted/50 uppercase tracking-[0.07em] select-none">
              {siteName}
            </span>
            <span className="oa-site-badge text-[0.6875rem] font-mono px-[7px] py-[3px] select-all">
              {hostname}
            </span>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto bg-canvas">
          {children}
        </main>
      </div>
    </div>
  )
}
