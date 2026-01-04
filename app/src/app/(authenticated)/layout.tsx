import Image from 'next/image'
import type { ReactNode } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/layout/app-header'
import { AppNavigation, type NavItem } from '@/components/layout/app-navigation'
import { UserAccountMenu } from '@/components/layout/user-account-menu'
import { AuthProvider } from '@/components/providers/auth-provider'
import { SupportWidget } from '@/components/layout/support-widget'
import { WaterWebGLProvider, WaterCanvas } from '@/components/water-webgl'
import { getSessionUser } from '@/lib/auth/server'

const NAV_ITEMS: NavItem[] = [
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
      <WaterWebGLProvider>
        <div className="min-h-screen" suppressHydrationWarning>
          <WaterCanvas />
          <AppHeader>
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
          </AppHeader>
          <main className="relative w-full px-12 py-10 pt-24">{children}</main>
          <SupportWidget />
        </div>
      </WaterWebGLProvider>
    </AuthProvider>
  )
}
