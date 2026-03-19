'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DashboardActionableData } from '@/types/dashboard'
import { getDashboardData } from '@/lib/api/analytics'

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
      const payload = await getDashboardData(projectId)
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
