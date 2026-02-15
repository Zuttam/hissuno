'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DashboardActionableData } from '@/types/dashboard'

interface UseDashboardDataOptions {
  projectId: string
}

interface UseDashboardDataState {
  data: DashboardActionableData | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useDashboardData({
  projectId,
}: UseDashboardDataOptions): UseDashboardDataState {
  const [data, setData] = useState<DashboardActionableData | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    if (!projectId) {
      setIsLoading(false)
      return
    }
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/projects/${projectId}/dashboard`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message =
          typeof payload?.error === 'string'
            ? payload.error
            : 'Failed to load dashboard data.'
        throw new Error(message)
      }

      const payload = await response.json()
      setData(payload)
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Unexpected error loading dashboard data.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void fetchData()
  }, [fetchData])

  return useMemo(
    () => ({
      data,
      isLoading,
      error,
      refresh: fetchData,
    }),
    [data, isLoading, error, fetchData]
  )
}
