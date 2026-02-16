'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ApiKeyRecord } from '@/types/project-members'

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
      const response = await fetch(`/api/projects/${projectId}/api-keys`, { cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load API keys.'
        throw new Error(message)
      }
      const payload = await response.json()
      setApiKeys(payload.apiKeys ?? [])
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
