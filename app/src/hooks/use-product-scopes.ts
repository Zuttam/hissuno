'use client'

import { useMemo } from 'react'
import type { ProductScopeRecord } from '@/types/product-scope'
import { listProductScopes } from '@/lib/api/settings'
import { useFetchData } from './use-fetch-data'

interface UseProductScopesOptions {
  projectId?: string
  initialScopes?: ProductScopeRecord[]
}

interface UseProductScopesState {
  scopes: ProductScopeRecord[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useProductScopes({
  projectId,
  initialScopes = [],
}: UseProductScopesOptions): UseProductScopesState {
  const { data, isLoading, error, refresh } = useFetchData<ProductScopeRecord[]>({
    fetchFn: () => listProductScopes(projectId!),
    deps: [projectId],
    initialData: initialScopes,
    initialLoading: initialScopes.length === 0 && Boolean(projectId),
    skip: !projectId,
    errorPrefix: 'Unexpected error loading product scopes',
  })

  return useMemo(
    () => ({ scopes: data ?? [], isLoading, error, refresh }),
    [data, isLoading, error, refresh]
  )
}
