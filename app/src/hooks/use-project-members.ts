'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ProjectMemberWithProfile } from '@/types/project-members'
import { listMembers } from '@/lib/api/members'

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
      const result = await listMembers(projectId)
      setMembers(result)
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
