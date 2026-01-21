'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useProject } from '@/components/providers/project-provider'
import { useProjects } from '@/hooks/use-projects'
import type { ProjectRecord } from '@/lib/supabase/projects'

interface ProjectsRedirectProps {
  initialProjects: ProjectRecord[]
}

export function ProjectsRedirect({ initialProjects }: ProjectsRedirectProps) {
  const router = useRouter()
  const { projectId, setProjectId, isLoading: isProjectLoading } = useProject()
  const { projects, isLoading: isProjectsLoading } = useProjects(initialProjects)

  useEffect(() => {
    // Wait for both contexts to initialize
    if (isProjectLoading || isProjectsLoading) return

    // Case 1: User has a selected project in context - redirect to it
    if (projectId) {
      router.replace(`/projects/${projectId}`)
      return
    }

    // Case 2: No selected project but projects exist - select first and redirect
    if (projects.length > 0) {
      const firstProject = projects[0]
      setProjectId(firstProject.id)
      router.replace(`/projects/${firstProject.id}`)
      return
    }

    // Case 3: No projects at all - redirect to create new
    router.replace('/projects/new')
  }, [projectId, projects, isProjectLoading, isProjectsLoading, setProjectId, router])

  return (
    <div className="flex h-full items-center justify-center">
      <div className="animate-pulse font-mono text-sm text-[color:var(--text-secondary)]">
        Loading...
      </div>
    </div>
  )
}
