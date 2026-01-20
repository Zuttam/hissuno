import type { ReactNode } from 'react'
import Link from 'next/link'
import { AppHeader } from '@/components/layout/app-header'
import { AppNavigation, type NavItem } from '@/components/layout/app-navigation'
import { MobileNavigation } from '@/components/layout/mobile-navigation'
import { ProjectsDropdown } from '@/components/layout/projects-dropdown'
import { UserAccountMenu } from '@/components/layout/user-account-menu'
import { AuthProvider } from '@/components/providers/auth-provider'
import { SupportWidget } from '@/components/layout/support-widget'
import { WaterWebGLProvider, WaterCanvas } from '@/components/water-webgl'
import { getSessionUser } from '@/lib/auth/server'
import { ThemeLogo } from '@/components/ui'

const NAV_ITEMS: NavItem[] = [
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
                <ThemeLogo width={56} height={16} priority />
              </Link>
              <AppNavigation items={NAV_ITEMS} leadingElement={<ProjectsDropdown />} />
              <div className="flex items-center gap-2">
                <UserAccountMenu user={user} />
                <MobileNavigation items={NAV_ITEMS} />
              </div>
            </div>
          </AppHeader>
          <main className="relative w-full px-4 py-8 pt-20">{children}</main>
          <SupportWidget />
        </div>
      </WaterWebGLProvider>
    </AuthProvider>
  )
}
