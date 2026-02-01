'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PromotionRecord } from '@/types/invites'

interface UsePromotionsState {
  promotions: PromotionRecord[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function usePromotions(): UsePromotionsState {
  const [promotions, setPromotions] = useState<PromotionRecord[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchPromotions = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/user/promotions', { cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load promotions.'
        throw new Error(message)
      }
      const payload = await response.json()
      setPromotions(payload.promotions ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading promotions.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchPromotions()
  }, [fetchPromotions])

  return useMemo(
    () => ({
      promotions,
      isLoading,
      error,
      refresh: fetchPromotions,
    }),
    [promotions, isLoading, error, fetchPromotions]
  )
}
