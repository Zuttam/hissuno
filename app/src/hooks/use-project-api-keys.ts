'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ApiKeyRecord } from '@/types/project-members'
import { listApiKeys } from '@/lib/api/api-keys'

interface UseProjectApiKeysState {
  apiKeys: ApiKeyRecord[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useProjectApiKeys(projectId: string | undefined): UseProjectApiKeysState {
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(projectId))
  const [error, setError] = useState<string | null>(null)

  const fetchApiKeys = useCallback(async () => {
    if (!projectId) {
      setApiKeys([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await listApiKeys(projectId)
      setApiKeys(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading API keys.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void fetchApiKeys()
  }, [fetchApiKeys])

  return useMemo(
    () => ({
      apiKeys,
      isLoading,
      error,
      refresh: fetchApiKeys,
    }),
    [apiKeys, isLoading, error, fetchApiKeys]
  )
}
