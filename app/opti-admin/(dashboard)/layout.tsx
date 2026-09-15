import { redirect } from 'next/navigation'
import { isValidAdminSession } from '@/lib/admin/requireSession'
import AdminShell from '@/components/admin/AdminShell'

// Never statically generate admin pages — they require live Graph data and
// auth cookie checks that are only available at request time.
export const dynamic = 'force-dynamic'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!await isValidAdminSession()) redirect('/opti-admin/login')
  return <AdminShell>{children}</AdminShell>
}
