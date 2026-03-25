'use client'

import type { DashboardActionableData } from '@/types/dashboard'
import { getDashboardData } from '@/lib/api/analytics'
import { useFetchData } from './use-fetch-data'

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
  return useFetchData<DashboardActionableData>({
    fetchFn: () => getDashboardData(projectId),
    deps: [projectId],
    skip: !projectId,
    errorPrefix: 'Unexpected error loading dashboard data',
  })
}
