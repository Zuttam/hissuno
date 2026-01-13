'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { CustomTagRecord, CustomTagInput } from '@/types/session'

interface UseCustomTagsOptions {
  projectId?: string
  initialTags?: CustomTagRecord[]
}

interface UseCustomTagsState {
  tags: CustomTagRecord[]
  isLoading: boolean
  error: string | null
  canAddMore: boolean
  refresh: () => Promise<void>
  createTag: (input: CustomTagInput) => Promise<CustomTagRecord | null>
  updateTag: (tagId: string, input: Partial<CustomTagInput>) => Promise<CustomTagRecord | null>
  deleteTag: (tagId: string) => Promise<boolean>
}

const MAX_TAGS = 10

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
      const response = await fetch(`/api/projects/${projectId}/settings/custom-tags`, {
        cache: 'no-store',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load custom tags.'
        throw new Error(message)
      }

      const payload = await response.json()
      setTags(payload.tags ?? [])
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

  const createTag = useCallback(
    async (input: CustomTagInput): Promise<CustomTagRecord | null> => {
      if (!projectId) {
        setError('No project selected.')
        return null
      }

      try {
        const response = await fetch(`/api/projects/${projectId}/settings/custom-tags`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          const message = typeof payload?.error === 'string' ? payload.error : 'Failed to create tag.'
          throw new Error(message)
        }

        const payload = await response.json()
        const newTag = payload.tag as CustomTagRecord

        // Add to local state
        setTags((prev) => [...prev, newTag])

        return newTag
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected error creating tag.'
        setError(message)
        return null
      }
    },
    [projectId]
  )

  const updateTag = useCallback(
    async (tagId: string, input: Partial<CustomTagInput>): Promise<CustomTagRecord | null> => {
      if (!projectId) {
        setError('No project selected.')
        return null
      }

      try {
        const response = await fetch(`/api/projects/${projectId}/settings/custom-tags/${tagId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          const message = typeof payload?.error === 'string' ? payload.error : 'Failed to update tag.'
          throw new Error(message)
        }

        const payload = await response.json()
        const updatedTag = payload.tag as CustomTagRecord

        // Update local state
        setTags((prev) =>
          prev.map((tag) => (tag.id === tagId ? updatedTag : tag))
        )

        return updatedTag
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected error updating tag.'
        setError(message)
        return null
      }
    },
    [projectId]
  )

  const deleteTag = useCallback(
    async (tagId: string): Promise<boolean> => {
      if (!projectId) {
        setError('No project selected.')
        return false
      }

      try {
        const response = await fetch(`/api/projects/${projectId}/settings/custom-tags/${tagId}`, {
          method: 'DELETE',
        })

        if (!response.ok) {
          const payload = await response.json().catch(() => null)
          const message = typeof payload?.error === 'string' ? payload.error : 'Failed to delete tag.'
          throw new Error(message)
        }

        // Remove from local state
        setTags((prev) => prev.filter((tag) => tag.id !== tagId))

        return true
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unexpected error deleting tag.'
        setError(message)
        return false
      }
    },
    [projectId]
  )

  return useMemo(
    () => ({
      tags,
      isLoading,
      error,
      canAddMore: tags.length < MAX_TAGS,
      refresh: fetchTags,
      createTag,
      updateTag,
      deleteTag,
    }),
    [tags, isLoading, error, fetchTags, createTag, updateTag, deleteTag]
  )
}
