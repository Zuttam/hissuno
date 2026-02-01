'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { InviteWithClaimInfo } from '@/types/invites'

interface UseInvitesState {
  invites: InviteWithClaimInfo[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useInvites(): UseInvitesState {
  const [invites, setInvites] = useState<InviteWithClaimInfo[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchInvites = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/user/invites', { cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load invites.'
        throw new Error(message)
      }
      const payload = await response.json()
      setInvites(payload.invites ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading invites.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchInvites()
  }, [fetchInvites])

  return useMemo(
    () => ({
      invites,
      isLoading,
      error,
      refresh: fetchInvites,
    }),
    [invites, isLoading, error, fetchInvites]
  )
}
