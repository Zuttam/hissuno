'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ProjectMemberWithProfile } from '@/types/project-members'

interface UseProjectMembersState {
  members: ProjectMemberWithProfile[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useProjectMembers(projectId: string | undefined): UseProjectMembersState {
  const [members, setMembers] = useState<ProjectMemberWithProfile[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(projectId))
  const [error, setError] = useState<string | null>(null)

  const fetchMembers = useCallback(async () => {
    if (!projectId) {
      setMembers([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/members`, { cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load members.'
        throw new Error(message)
      }
      const payload = await response.json()
      setMembers(payload.members ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading members.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void fetchMembers()
  }, [fetchMembers])

  return useMemo(
    () => ({
      members,
      isLoading,
      error,
      refresh: fetchMembers,
    }),
    [members, isLoading, error, fetchMembers]
  )
}
