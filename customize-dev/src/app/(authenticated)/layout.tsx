import Image from 'next/image'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { AppNavigation, type NavItem } from '@/components/layout/app-navigation'
import { UserAccountMenu } from '@/components/layout/user-account-menu'
import { getSessionUser } from '@/lib/auth/server'

const NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Home' },
  { href: '/projects', label: 'Projects' },
  { href: '/sessions', label: 'Sessions' },
  { href: '/user-assets', label: 'User Assets', disabled: true },
]

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode
}) {
  const user = await getSessionUser()

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-50" suppressHydrationWarning>
      <header className="relative z-50 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/60">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 py-5">
          <Link
            href="/"
            className="flex items-center mr-6 gap-3 text-lg font-semibold text-slate-900 transition hover:text-slate-700 dark:text-white"
          >
            <Image src="/logo.svg" alt="Customize logo" width={40} height={40} priority />
            <span className="hidden sm:inline">CustomizeAI</span>
          </Link>
          <AppNavigation items={NAV_ITEMS} />
          <UserAccountMenu user={user} />
        </div>
      </header>
      <main className="mx-auto w-full px-12 py-10">{children}</main>
    </div>
  )
}
