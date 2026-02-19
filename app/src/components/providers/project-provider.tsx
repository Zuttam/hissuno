'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ProjectRecord } from '@/lib/supabase/projects'

const LAST_PROJECT_KEY = 'hissuno-last-project'


interface ProjectContextValue {
  // Current project
  project: ProjectRecord | null
  projectId: string | null
  setProjectId: (id: string | null) => void
  isLoading: boolean
  refreshProject: () => Promise<void>
  // All projects
  projects: ProjectRecord[]
  isLoadingProjects: boolean
  projectsError: string | null
  refreshProjects: () => Promise<void>
}

const ProjectContext = createContext<ProjectContextValue | null>(null)

export function useProject(): ProjectContextValue {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider')
  }
  return context
}

export function useProjectOptional(): ProjectContextValue | null {
  return useContext(ProjectContext)
}

function getStoredProjectId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem(LAST_PROJECT_KEY)
}

function storeProjectId(id: string | null): void {
  if (typeof window === 'undefined') return
  if (id) {
    localStorage.setItem(LAST_PROJECT_KEY, id)
  } else {
    localStorage.removeItem(LAST_PROJECT_KEY)
  }
}

interface ProjectProviderProps {
  children: ReactNode
}

export function ProjectProvider({ children }: ProjectProviderProps) {
  const [projectId, setProjectIdState] = useState<string | null>(null)
  const [project, setProject] = useState<ProjectRecord | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Projects list state
  const [projects, setProjects] = useState<ProjectRecord[]>([])
  const [isLoadingProjects, setIsLoadingProjects] = useState(true)
  const [projectsError, setProjectsError] = useState<string | null>(null)

  // Load stored project ID on mount
  useEffect(() => {
    const storedId = getStoredProjectId()
    if (storedId) {
      setProjectIdState(storedId)
    }
    setIsInitialized(true)
  }, [])

  // --- Current project fetching ---

  const fetchProject = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/projects/${id}`, { cache: 'no-store' })

      if (!response.ok) {
        console.error('[ProjectProvider] failed to fetch project', id)
        setProject(null)
        storeProjectId(null)
        setProjectIdState(null)
        return
      }

      const payload = await response.json()
      setProject(payload.project ?? null)
    } catch (error) {
      console.error('[ProjectProvider] error fetching project', error)
      setProject(null)
    }
  }, [])

  // Fetch project data when projectId changes
  useEffect(() => {
    if (!isInitialized) return

    if (!projectId) {
      setProject(null)
      setIsLoading(false)
      return
    }

    let cancelled = false
    setIsLoading(true)

    void fetchProject(projectId).then(() => {
      if (!cancelled) setIsLoading(false)
    })

    return () => {
      cancelled = true
    }
  }, [projectId, isInitialized, fetchProject])

  const refreshProject = useCallback(async () => {
    if (projectId) {
      await fetchProject(projectId)
    }
  }, [projectId, fetchProject])

  const setProjectId = useCallback((id: string | null) => {
    storeProjectId(id)
    setProjectIdState(id)
  }, [])

  // --- Projects list fetching ---

  const fetchProjects = useCallback(async () => {
    setIsLoadingProjects(true)
    setProjectsError(null)
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
      setProjectsError(message)
    } finally {
      setIsLoadingProjects(false)
    }
  }, [])

  useEffect(() => {
    void fetchProjects()
  }, [fetchProjects])

  // --- Context value ---

  const value = useMemo(
    () => ({
      project,
      projectId,
      setProjectId,
      isLoading: !isInitialized || isLoading,
      refreshProject,
      projects,
      isLoadingProjects,
      projectsError,
      refreshProjects: fetchProjects,
    }),
    [project, projectId, setProjectId, isLoading, isInitialized, refreshProject, projects, isLoadingProjects, projectsError, fetchProjects]
  )

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}
