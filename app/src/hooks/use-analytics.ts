'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AnalyticsPeriod,
  OverallAnalytics,
  ProjectAnalytics,
  SessionsStripAnalytics,
  IssuesStripAnalytics,
  ImpactFlowGraphData,
  CustomerSegmentationAnalytics,
} from '@/lib/supabase/analytics'

interface UseAnalyticsOptions {
  period?: AnalyticsPeriod
  projectId?: string
}

interface UseAnalyticsState {
  data: OverallAnalytics | null
  isLoading: boolean
  error: string | null
  period: AnalyticsPeriod
  setPeriod: (period: AnalyticsPeriod) => void
  refresh: () => Promise<void>
}

export function useAnalytics({
  period: initialPeriod = '30d',
  projectId,
}: UseAnalyticsOptions = {}): UseAnalyticsState {
  const [data, setData] = useState<OverallAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<AnalyticsPeriod>(initialPeriod)

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('period', period)
      if (projectId) params.set('projectId', projectId)

      const response = await fetch(`/api/analytics?${params.toString()}`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load analytics.'
        throw new Error(message)
      }

      const payload = await response.json()
      setData(payload.data ?? null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading analytics.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [period, projectId])

  useEffect(() => {
    void fetchAnalytics()
  }, [fetchAnalytics])

  return useMemo(
    () => ({
      data,
      isLoading,
      error,
      period,
      setPeriod,
      refresh: fetchAnalytics,
    }),
    [data, isLoading, error, period, fetchAnalytics]
  )
}

interface UseProjectAnalyticsOptions {
  projectId: string
  period?: AnalyticsPeriod
}

interface UseProjectAnalyticsState {
  data: ProjectAnalytics | null
  isLoading: boolean
  error: string | null
  period: AnalyticsPeriod
  setPeriod: (period: AnalyticsPeriod) => void
  refresh: () => Promise<void>
}

export function useProjectAnalytics({
  projectId,
  period: initialPeriod = '30d',
}: UseProjectAnalyticsOptions): UseProjectAnalyticsState {
  const [data, setData] = useState<ProjectAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<AnalyticsPeriod>(initialPeriod)

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('type', 'project')
      params.set('projectId', projectId)
      params.set('period', period)

      const response = await fetch(`/api/analytics?${params.toString()}`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load project analytics.'
        throw new Error(message)
      }

      const payload = await response.json()
      setData(payload.data ?? null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading project analytics.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, period])

  useEffect(() => {
    void fetchAnalytics()
  }, [fetchAnalytics])

  return useMemo(
    () => ({
      data,
      isLoading,
      error,
      period,
      setPeriod,
      refresh: fetchAnalytics,
    }),
    [data, isLoading, error, period, fetchAnalytics]
  )
}

interface UseSessionsStripAnalyticsOptions {
  projectId?: string
}

interface UseSessionsStripAnalyticsState {
  data: SessionsStripAnalytics | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useSessionsStripAnalytics({
  projectId,
}: UseSessionsStripAnalyticsOptions = {}): UseSessionsStripAnalyticsState {
  const [data, setData] = useState<SessionsStripAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('type', 'sessions-strip')
      if (projectId) params.set('projectId', projectId)

      const response = await fetch(`/api/analytics?${params.toString()}`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load session analytics.'
        throw new Error(message)
      }

      const payload = await response.json()
      setData(payload.data ?? null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading session analytics.'
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

interface UseIssuesStripAnalyticsOptions {
  projectId?: string
}

interface UseIssuesStripAnalyticsState {
  data: IssuesStripAnalytics | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useIssuesStripAnalytics({
  projectId,
}: UseIssuesStripAnalyticsOptions = {}): UseIssuesStripAnalyticsState {
  const [data, setData] = useState<IssuesStripAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('type', 'issues-strip')
      if (projectId) params.set('projectId', projectId)

      const response = await fetch(`/api/analytics?${params.toString()}`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load issue analytics.'
        throw new Error(message)
      }

      const payload = await response.json()
      setData(payload.data ?? null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading issue analytics.'
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

interface UseImpactFlowAnalyticsOptions {
  period?: AnalyticsPeriod
  projectId?: string
}

interface UseImpactFlowAnalyticsState {
  data: ImpactFlowGraphData | null
  isLoading: boolean
  error: string | null
  period: AnalyticsPeriod
  setPeriod: (period: AnalyticsPeriod) => void
  refresh: () => Promise<void>
}

export function useImpactFlowAnalytics({
  period: initialPeriod = '30d',
  projectId,
}: UseImpactFlowAnalyticsOptions = {}): UseImpactFlowAnalyticsState {
  const [data, setData] = useState<ImpactFlowGraphData | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [period, setPeriod] = useState<AnalyticsPeriod>(initialPeriod)

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('type', 'impact-flow')
      params.set('period', period)
      if (projectId) params.set('projectId', projectId)

      const response = await fetch(`/api/analytics?${params.toString()}`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load impact flow analytics.'
        throw new Error(message)
      }

      const payload = await response.json()
      setData(payload.data ?? null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading impact flow analytics.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [period, projectId])

  useEffect(() => {
    void fetchAnalytics()
  }, [fetchAnalytics])

  return useMemo(
    () => ({
      data,
      isLoading,
      error,
      period,
      setPeriod,
      refresh: fetchAnalytics,
    }),
    [data, isLoading, error, period, fetchAnalytics]
  )
}

interface UseCustomerSegmentationAnalyticsOptions {
  projectId: string
  period: AnalyticsPeriod
}

interface UseCustomerSegmentationAnalyticsState {
  data: CustomerSegmentationAnalytics | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useCustomerSegmentationAnalytics({
  projectId,
  period,
}: UseCustomerSegmentationAnalyticsOptions): UseCustomerSegmentationAnalyticsState {
  const [data, setData] = useState<CustomerSegmentationAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      params.set('type', 'customer-segmentation')
      params.set('projectId', projectId)
      params.set('period', period)

      const response = await fetch(`/api/analytics?${params.toString()}`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load customer segmentation analytics.'
        throw new Error(message)
      }

      const payload = await response.json()
      setData(payload.data ?? null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading customer segmentation analytics.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, period])

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
