'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CustomTagRecord } from '@/types/session'
import { listCustomTags } from '@/lib/api/settings'

interface UseCustomTagsOptions {
  projectId?: string
  initialTags?: CustomTagRecord[]
}

interface UseCustomTagsState {
  tags: CustomTagRecord[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useCustomTags({
  projectId,
  initialTags = [],
}: UseCustomTagsOptions): UseCustomTagsState {
  const [tags, setTags] = useState<CustomTagRecord[]>(initialTags)
  const [isLoading, setIsLoading] = useState<boolean>(initialTags.length === 0 && Boolean(projectId))
  const [error, setError] = useState<string | null>(null)

  const fetchTags = useCallback(async () => {
    if (!projectId) {
      setTags([])
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const result = await listCustomTags(projectId)
      setTags(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading custom tags.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void fetchTags()
  }, [fetchTags])

  return useMemo(
    () => ({
      tags,
      isLoading,
      error,
      refresh: fetchTags,
    }),
    [tags, isLoading, error, fetchTags]
  )
}
