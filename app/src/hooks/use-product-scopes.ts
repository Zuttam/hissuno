'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ProductScopeRecord } from '@/types/product-scope'
import { listProductScopes } from '@/lib/api/settings'

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
  const [scopes, setScopes] = useState<ProductScopeRecord[]>(initialScopes)
  const [isLoading, setIsLoading] = useState<boolean>(initialScopes.length === 0 && Boolean(projectId))
  const [error, setError] = useState<string | null>(null)

  const fetchScopes = useCallback(async () => {
    if (!projectId) {
      setScopes([])
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await listProductScopes(projectId)
      setScopes(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading product scopes.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void fetchScopes()
  }, [fetchScopes])

  return useMemo(
    () => ({
      scopes,
      isLoading,
      error,
      refresh: fetchScopes,
    }),
    [scopes, isLoading, error, fetchScopes]
  )
}
