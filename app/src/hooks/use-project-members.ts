'use client'

import { useMemo } from 'react'
import type { ProjectMemberWithProfile } from '@/types/project-members'
import { listMembers } from '@/lib/api/members'
import { useFetchData } from './use-fetch-data'

interface UseProjectMembersState {
  members: ProjectMemberWithProfile[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useProjectMembers(projectId: string | undefined): UseProjectMembersState {
  const { data, isLoading, error, refresh } = useFetchData<ProjectMemberWithProfile[]>({
    fetchFn: () => listMembers(projectId!),
    deps: [projectId],
    initialLoading: Boolean(projectId),
    skip: !projectId,
    errorPrefix: 'Unexpected error loading members',
  })

  return useMemo(
    () => ({ members: data ?? [], isLoading, error, refresh }),
    [data, isLoading, error, refresh]
  )
}
