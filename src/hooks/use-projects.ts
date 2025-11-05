import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ProjectAnalysisRecord, ProjectWithAnalyses } from '@/lib/supabase/projects'

interface UseProjectsState {
  projects: ProjectWithAnalyses[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useProjects(initialProjects: ProjectWithAnalyses[] = []): UseProjectsState {
  const [projects, setProjects] = useState<ProjectWithAnalyses[]>(initialProjects)
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
  autoRefresh?: boolean
  initialProject?: ProjectWithAnalyses | null
}

interface UseProjectDetailState {
  project: ProjectWithAnalyses | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  latestAnalysis: ProjectAnalysisRecord | null
}

export function useProjectDetail({
  projectId,
  autoRefresh = false,
  initialProject = null,
}: UseProjectDetailOptions): UseProjectDetailState {
  const [project, setProject] = useState<ProjectWithAnalyses | null>(initialProject)
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

  useEffect(() => {
    if (!autoRefresh || !projectId) return

    const interval = setInterval(() => {
      void fetchProject()
    }, 10_000)

    return () => clearInterval(interval)
  }, [autoRefresh, projectId, fetchProject])

  const latestAnalysis = useMemo(() => {
    if (!project?.project_analyses?.length) return null
    return project.project_analyses[0]
  }, [project])

  return useMemo(
    () => ({
      project,
      isLoading,
      error,
      refresh: fetchProject,
      latestAnalysis,
    }),
    [project, isLoading, error, fetchProject, latestAnalysis]
  )
}

