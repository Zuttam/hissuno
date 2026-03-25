'use client'

import { useMemo } from 'react'
import type { ApiKeyRecord } from '@/types/project-members'
import { listApiKeys } from '@/lib/api/api-keys'
import { useFetchData } from './use-fetch-data'

interface UseProjectApiKeysState {
  apiKeys: ApiKeyRecord[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useProjectApiKeys(projectId: string | undefined): UseProjectApiKeysState {
  const { data, isLoading, error, refresh } = useFetchData<ApiKeyRecord[]>({
    fetchFn: () => listApiKeys(projectId!),
    deps: [projectId],
    initialLoading: Boolean(projectId),
    skip: !projectId,
    errorPrefix: 'Unexpected error loading API keys',
  })

  return useMemo(
    () => ({ apiKeys: data ?? [], isLoading, error, refresh }),
    [data, isLoading, error, refresh]
  )
}
