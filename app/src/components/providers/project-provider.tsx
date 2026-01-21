'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { ProjectRecord } from '@/lib/supabase/projects'

const LAST_PROJECT_KEY = 'hissuno-last-project'


interface ProjectContextValue {
  project: ProjectRecord | null
  projectId: string | null
  setProjectId: (id: string | null) => void
  isLoading: boolean
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

  // Load stored project ID on mount
  useEffect(() => {
    const storedId = getStoredProjectId()
    if (storedId) {
      setProjectIdState(storedId)
    }
    setIsInitialized(true)
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

    async function fetchProject() {
      try {
        const response = await fetch(`/api/projects/${projectId}`, { cache: 'no-store' })
        if (cancelled) return

        if (!response.ok) {
          // Project might not exist or user might not have access
          console.error('[ProjectProvider] failed to fetch project', projectId)
          setProject(null)
          // Clear stored ID if project is not accessible
          storeProjectId(null)
          setProjectIdState(null)
          return
        }

        const payload = await response.json()
        if (cancelled) return

        setProject(payload.project ?? null)
      } catch (error) {
        if (cancelled) return
        console.error('[ProjectProvider] error fetching project', error)
        setProject(null)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void fetchProject()

    return () => {
      cancelled = true
    }
  }, [projectId, isInitialized])

  const setProjectId = useCallback((id: string | null) => {
    storeProjectId(id)
    setProjectIdState(id)
  }, [])

  const value = useMemo(
    () => ({
      project,
      projectId,
      setProjectId,
      isLoading,
    }),
    [project, projectId, setProjectId, isLoading]
  )

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>
}
