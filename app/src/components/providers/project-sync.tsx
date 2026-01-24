'use client'

import { useEffect } from 'react'
import { useProject } from './project-provider'

interface ProjectSyncProps {
  projectId: string
}

/**
 * Client component that syncs a URL-based project ID to the app-level project state.
 * Used in project page layouts to ensure the app state reflects the current route.
 */
export function ProjectSync({ projectId }: ProjectSyncProps) {
  const { setProjectId, projectId: currentProjectId } = useProject()

  useEffect(() => {
    // Only update if the project ID differs to avoid unnecessary state updates
    if (projectId && projectId !== currentProjectId) {
      setProjectId(projectId)
    }
  }, [projectId, currentProjectId, setProjectId])

  return null
}
