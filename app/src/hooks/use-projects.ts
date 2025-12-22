'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ProjectWithCodebase } from '@/lib/projects/queries'

interface UseProjectsState {
  projects: ProjectWithCodebase[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useProjects(initialProjects: ProjectWithCodebase[] = []): UseProjectsState {
  const [projects, setProjects] = useState<ProjectWithCodebase[]>(initialProjects)
  const [isLoading, setIsLoading] = useState<boolean>(initialProjects.length === 0)
  const [error, setError] = useState<string | null>(null)

  const fetchProjects = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/projects', { cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load projects.'
        throw new Error(message)
      }
      const payload = await response.json()
      setProjects(payload.projects ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading projects.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchProjects()
  }, [fetchProjects])

  return useMemo(
    () => ({
      projects,
      isLoading,
      error,
      refresh: fetchProjects,
    }),
    [projects, isLoading, error, fetchProjects]
  )
}

interface UseProjectDetailOptions {
  projectId?: string
  initialProject?: ProjectWithCodebase | null
}

interface UseProjectDetailState {
  project: ProjectWithCodebase | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useProjectDetail({
  projectId,
  initialProject = null,
}: UseProjectDetailOptions): UseProjectDetailState {
  const [project, setProject] = useState<ProjectWithCodebase | null>(initialProject)
  const [isLoading, setIsLoading] = useState<boolean>(initialProject ? false : Boolean(projectId))
  const [error, setError] = useState<string | null>(null)

  const fetchProject = useCallback(async () => {
    if (!projectId) {
      setProject(null)
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}`, { cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load project.'
        throw new Error(message)
      }
      const payload = await response.json()
      setProject(payload.project ?? null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading project.'
      setError(message)
      setProject(null)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void fetchProject()
  }, [fetchProject])

  return useMemo(
    () => ({
      project,
      isLoading,
      error,
      refresh: fetchProject,
    }),
    [project, isLoading, error, fetchProject]
  )
}
