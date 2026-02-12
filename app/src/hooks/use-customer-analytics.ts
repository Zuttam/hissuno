'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CustomersStripAnalytics } from '@/types/customer'

interface UseCustomerAnalyticsOptions {
  projectId?: string | null
}

interface UseCustomerAnalyticsState {
  data: CustomersStripAnalytics | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useCustomerAnalytics({
  projectId,
}: UseCustomerAnalyticsOptions = {}): UseCustomerAnalyticsState {
  const [data, setData] = useState<CustomersStripAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async () => {
    if (!projectId) {
      setData(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/projects/${projectId}/customers/analytics`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load customer analytics.'
        throw new Error(message)
      }

      const payload = await response.json()
      setData(payload.data ?? null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading customer analytics.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void fetchAnalytics()
  }, [fetchAnalytics])

  return useMemo(
    () => ({
      data,
      isLoading,
      error,
      refresh: fetchAnalytics,
    }),
    [data, isLoading, error, fetchAnalytics]
  )
}
