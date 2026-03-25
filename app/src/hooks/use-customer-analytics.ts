'use client'

import type { CustomersStripAnalytics } from '@/types/customer'
import { getCustomerAnalytics } from '@/lib/api/customers'
import { useFetchData } from './use-fetch-data'

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
  return useFetchData<CustomersStripAnalytics>({
    fetchFn: () => getCustomerAnalytics(projectId!),
    deps: [projectId],
    skip: !projectId,
    errorPrefix: 'Unexpected error loading customer analytics',
  })
}
