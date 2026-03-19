import type { ReactNode } from 'react'
import { connection } from 'next/server'
import { redirect } from 'next/navigation'
import { AuthProvider } from '@/components/providers/auth-provider'
import { ProjectProvider } from '@/components/providers/project-provider'
import { CopilotProvider } from '@/components/providers/copilot-provider'
import { AuthenticatedContent } from '@/components/layout/authenticated-content'
import { AppSidebar } from '@/components/layout/sidebar'
import { CopilotSidebar } from '@/components/copilot'
import { getSessionUser } from '@/lib/auth/server'

export default async function AuthenticatedLayout({
  children,
}: {
  children: ReactNode
}) {
  await connection()
  const user = await getSessionUser()

  if (!user) {
    redirect('/login')
  }

  return (
    <AuthProvider>
      <ProjectProvider>
        <CopilotProvider>
          <div className="flex h-screen overflow-hidden" suppressHydrationWarning>
            <AppSidebar user={user} />
            <AuthenticatedContent>
              {children}
            </AuthenticatedContent>
            <CopilotSidebar />
          </div>
        </CopilotProvider>
      </ProjectProvider>
    </AuthProvider>
  )
}
