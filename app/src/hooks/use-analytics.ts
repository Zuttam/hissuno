'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  AnalyticsPeriod,
  OverallAnalytics,
  ProjectAnalytics,
  SessionsStripAnalytics,
  IssuesStripAnalytics,
  CustomerSegmentationAnalytics,
  EntityGraphAnalytics,
} from '@/lib/db/queries/analytics'
import {
  getOverallAnalytics,
  getProjectAnalytics as fetchProjectAnalytics,
  getSessionsStripAnalytics,
  getIssuesStripAnalytics,
  getCustomerSegmentationAnalytics,
  getEntityGraphAnalytics,
} from '@/lib/api/analytics'

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
      const result = await getOverallAnalytics(period, projectId)
      setData(result)
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
      const result = await fetchProjectAnalytics(projectId, period)
      setData(result)
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
      const result = await getSessionsStripAnalytics(projectId)
      setData(result)
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
      const result = await getIssuesStripAnalytics(projectId)
      setData(result)
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
      const result = await getCustomerSegmentationAnalytics(projectId, period)
      setData(result)
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

interface UseEntityGraphAnalyticsOptions {
  projectId: string
}

interface UseEntityGraphAnalyticsState {
  data: EntityGraphAnalytics | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useEntityGraphAnalytics({
  projectId,
}: UseEntityGraphAnalyticsOptions): UseEntityGraphAnalyticsState {
  const [data, setData] = useState<EntityGraphAnalytics | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnalytics = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const result = await getEntityGraphAnalytics(projectId)
      setData(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading entity graph analytics.'
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
