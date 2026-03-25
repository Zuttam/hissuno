'use client'

import { useMemo } from 'react'
import type { CustomTagRecord } from '@/types/session'
import { listCustomTags } from '@/lib/api/settings'
import { useFetchData } from './use-fetch-data'

interface UseCustomTagsOptions {
  projectId?: string
  initialTags?: CustomTagRecord[]
}

interface UseCustomTagsState {
  tags: CustomTagRecord[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useCustomTags({
  projectId,
  initialTags = [],
}: UseCustomTagsOptions): UseCustomTagsState {
  const { data, isLoading, error, refresh } = useFetchData<CustomTagRecord[]>({
    fetchFn: () => listCustomTags(projectId!),
    deps: [projectId],
    initialData: initialTags,
    initialLoading: initialTags.length === 0 && Boolean(projectId),
    skip: !projectId,
    errorPrefix: 'Unexpected error loading custom tags',
  })

  return useMemo(
    () => ({ tags: data ?? [], isLoading, error, refresh }),
    [data, isLoading, error, refresh]
  )
}
