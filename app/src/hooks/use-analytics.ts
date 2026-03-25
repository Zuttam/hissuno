'use client'

import { useMemo, useState } from 'react'
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
import { useFetchData } from './use-fetch-data'

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
  const [period, setPeriod] = useState<AnalyticsPeriod>(initialPeriod)

  const { data, isLoading, error, refresh } = useFetchData<OverallAnalytics>({
    fetchFn: () => getOverallAnalytics(period, projectId),
    deps: [period, projectId],
    errorPrefix: 'Unexpected error loading analytics',
  })

  return useMemo(
    () => ({ data, isLoading, error, period, setPeriod, refresh }),
    [data, isLoading, error, period, refresh]
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
  const [period, setPeriod] = useState<AnalyticsPeriod>(initialPeriod)

  const { data, isLoading, error, refresh } = useFetchData<ProjectAnalytics>({
    fetchFn: () => fetchProjectAnalytics(projectId, period),
    deps: [projectId, period],
    errorPrefix: 'Unexpected error loading project analytics',
  })

  return useMemo(
    () => ({ data, isLoading, error, period, setPeriod, refresh }),
    [data, isLoading, error, period, refresh]
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
  return useFetchData<SessionsStripAnalytics>({
    fetchFn: () => getSessionsStripAnalytics(projectId),
    deps: [projectId],
    errorPrefix: 'Unexpected error loading session analytics',
  })
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
  return useFetchData<IssuesStripAnalytics>({
    fetchFn: () => getIssuesStripAnalytics(projectId),
    deps: [projectId],
    errorPrefix: 'Unexpected error loading issue analytics',
  })
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
  return useFetchData<CustomerSegmentationAnalytics>({
    fetchFn: () => getCustomerSegmentationAnalytics(projectId, period),
    deps: [projectId, period],
    errorPrefix: 'Unexpected error loading customer segmentation analytics',
  })
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
  return useFetchData<EntityGraphAnalytics>({
    fetchFn: () => getEntityGraphAnalytics(projectId),
    deps: [projectId],
    errorPrefix: 'Unexpected error loading entity graph analytics',
  })
}
