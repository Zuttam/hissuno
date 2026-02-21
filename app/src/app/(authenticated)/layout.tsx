import type { ReactNode } from 'react'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { AuthProvider } from '@/components/providers/auth-provider'
import { ProjectProvider } from '@/components/providers/project-provider'
import { SupportWidgetProvider } from '@/components/providers/support-widget-provider'
import { SupportWidget } from '@/components/layout/support-widget'
import { AuthenticatedContent } from '@/components/layout/authenticated-content'
import { WaterWebGLProvider, WaterCanvas } from '@/components/water-webgl'
import { AppSidebar } from '@/components/layout/sidebar'
import { getSessionUser } from '@/lib/auth/server'
import { isUserActivated } from '@/lib/invites/invite-service'

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode
}) {
  await connection()
  const user = await getSessionUser()

  if (user) {
    const activated = await isUserActivated(user.id)
    if (!activated) {
      redirect('/unauthorized')
    }
  }

  return (
    <AuthProvider>
      <ProjectProvider>
        <SupportWidgetProvider>
          <WaterWebGLProvider>
            <div className="flex h-screen overflow-hidden" suppressHydrationWarning>
              <WaterCanvas />
              <AppSidebar user={user} />
              <AuthenticatedContent>
                {children}
              </AuthenticatedContent>
              <SupportWidget />
            </div>
          </WaterWebGLProvider>
        </SupportWidgetProvider>
      </ProjectProvider>
    </AuthProvider>
  )
}
