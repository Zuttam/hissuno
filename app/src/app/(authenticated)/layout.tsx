import Image from 'next/image'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { AppNavigation, type NavItem } from '@/components/layout/app-navigation'
import { UserAccountMenu } from '@/components/layout/user-account-menu'
import { AuthProvider } from '@/components/providers/auth-provider'
import { SupportWidget } from '@/components/layout/support-widget'
import { getSessionUser } from '@/lib/auth/server'

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/projects', label: 'Projects' },
  { href: '/sessions', label: 'Sessions' },
  { href: '/issues', label: 'Issues' }
]

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await getSessionUser()

  return (
    <AuthProvider>
      <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50" suppressHydrationWarning>
        <header className="relative mx-auto py-4 px-12 z-50 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4">
            <Link
              href="/"
              className="flex items-center mr-6 gap-3 text-lg font-semibold text-slate-900 transition hover:text-slate-700 dark:text-white"
            >
              <Image src="/logo.png" alt="Hissuno logo" width={120} height={100} priority />
            </Link>
            <AppNavigation items={NAV_ITEMS} />
            <UserAccountMenu user={user} />
          </div>
        </header>
        <main className="mx-auto w-full px-12 py-10">{children}</main>
        <SupportWidget />
      </div>
    </AuthProvider>
  )
}
