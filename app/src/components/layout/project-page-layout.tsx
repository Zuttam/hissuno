'use client'

import { useProject } from '@/components/providers/project-provider'
import { ProjectRecord } from '@/lib/supabase/projects'
import { Button } from '@/components/ui'
import App from 'next/app'
import { AppHeader } from './app-header'




interface ProjectPageHeaderProps {
  project: ProjectRecord
  actions?: React.ReactNode
}

export function ProjectPageHeader({
  project,
  actions,
}: ProjectPageHeaderProps) {
  return (
    <header className="flex-shrink-0 h-16 flex items-center justify-between gap-4 pr-4 pl-16 md:px-6 border-b border-[color:var(--border-subtle)] backdrop-blur-xl bg-[color:var(--background)]/80 relative z-10">
      {/* Left side: Project name / Page title */}
      <div className="flex items-center gap-3 min-w-0">
        <span className="font-mono text-sm font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
          {project?.name}
        </span>
        <span className="text-[color:var(--text-tertiary)]">/</span>
        {project?.description && (
          <>
            <span className="hidden md:inline text-[color:var(--text-tertiary)]">—</span>
            <span className="hidden md:inline text-sm text-[color:var(--text-tertiary)] truncate max-w-md">
              {project?.description}
            </span>
          </>
        )}
      </div>

      {/* Right side: Actions */}
      {(actions) && (
        <div className="flex flex-shrink-0 items-center gap-2">
          {actions}
        </div>
      )}
    </header>
  )
}



interface ProjectPageLayoutProps {
  children: React.ReactNode
}

export function ProjectPageLayout({ children }: ProjectPageLayoutProps) {
  const { project } = useProject()

  return (
    <div className="flex flex-col h-full gap-6">
      <AppHeader 
        title={project?.name || 'Untitled Project'}
        description={project?.description || undefined}
      />  

      {/* Page content */}
      <div className="flex-1 flex flex-col gap-6 overflow-y-auto mx-4 md:mx-6 pb-6">
        {children}
      </div>
    </div>
  )
}
