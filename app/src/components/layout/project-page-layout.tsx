'use client'

import { useProject } from '@/components/providers/project-provider'
import { NotificationCenter } from '@/components/layout/notification-center'
import { CopilotToggleButton } from '@/components/copilot'
import { AppHeader, type HeaderAlert } from './app-header'

interface ProjectPageLayoutProps {
  children: React.ReactNode
}

export function ProjectPageLayout({ children }: ProjectPageLayoutProps) {
  const { project, projectId } = useProject()


  return (
    <div className="flex flex-col h-full gap-6">
      <AppHeader
        title={project?.name || 'Untitled Project'}
        description={project?.description || undefined}
        actions={
          <>
            <CopilotToggleButton />
            <NotificationCenter projectId={projectId ?? undefined} />
          </>
        }
      />

      {/* Page content */}
      <div className="flex-1 flex flex-col gap-6 overflow-y-auto overflow-x-hidden mx-4 md:mx-6 pb-6">
        {children}
      </div>
    </div>
  )
}
