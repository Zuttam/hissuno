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
  const { setProjectId } = useProject()

  useEffect(() => {
    if (projectId) {
      setProjectId(projectId)
    }
  }, [projectId, setProjectId])

  return null
}
