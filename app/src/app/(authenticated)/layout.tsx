import type { ReactNode } from 'react'
import { connection } from 'next/server'
import { AuthProvider } from '@/components/providers/auth-provider'
import { ProjectProvider } from '@/components/providers/project-provider'
import { SupportWidget } from '@/components/layout/support-widget'
import { WaterWebGLProvider, WaterCanvas } from '@/components/water-webgl'
import { AppSidebar } from '@/components/layout/sidebar'
import { getSessionUser } from '@/lib/auth/server'

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode
}) {
  await connection()
  const user = await getSessionUser()

  return (
    <AuthProvider>
      <ProjectProvider>
        <WaterWebGLProvider>
          <div className="flex h-screen overflow-hidden" suppressHydrationWarning>
            <WaterCanvas />
            <AppSidebar user={user} />
            <main className="relative flex-1 min-w-0 flex flex-col overflow-hidden">
              {children}
            </main>
            <SupportWidget />
          </div>
        </WaterWebGLProvider>
      </ProjectProvider>
    </AuthProvider>
  )
}
