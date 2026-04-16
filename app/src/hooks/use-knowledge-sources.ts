'use client'

import { useState, useCallback, useEffect, useMemo } from 'react'
import type { KnowledgeSourceWithCodebase } from '@/lib/knowledge/types'
import {
  listKnowledgeSources,
  addKnowledgeSource,
  updateKnowledgeSource,
  deleteKnowledgeSource,
} from '@/lib/api/knowledge'

interface UseKnowledgeSourcesOptions {
  projectId: string
}

interface UseKnowledgeSourcesState {
  sources: KnowledgeSourceWithCodebase[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  updateSource: (sourceId: string, updates: Record<string, unknown>) => Promise<boolean>
  deleteSource: (sourceId: string, options?: { children?: 'reparent' | 'delete' }) => Promise<boolean>
  addSource: (data: FormData | Record<string, unknown>) => Promise<KnowledgeSourceWithCodebase | null>
}

export function useKnowledgeSources({ projectId }: UseKnowledgeSourcesOptions): UseKnowledgeSourcesState {
  const [sources, setSources] = useState<KnowledgeSourceWithCodebase[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchSources = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const data = await listKnowledgeSources(projectId)
      setSources(data.sources ?? [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge sources')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void fetchSources()
  }, [fetchSources])

  const updateSourceFn = useCallback(async (sourceId: string, updates: Record<string, unknown>): Promise<boolean> => {
    try {
      const data = await updateKnowledgeSource(projectId, sourceId, updates)
      setSources(prev => prev.map(s => s.id === sourceId ? { ...s, ...data.source } : s))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update source')
      return false
    }
  }, [projectId])

  const deleteSourceFn = useCallback(async (
    sourceId: string,
    options?: { children?: 'reparent' | 'delete' },
  ): Promise<boolean> => {
    try {
      await deleteKnowledgeSource(projectId, sourceId, options)
      if (options?.children === 'delete') {
        const toRemove = new Set<string>([sourceId])
        const queue = [sourceId]
        while (queue.length > 0) {
          const parentId = queue.pop()!
          for (const s of sources) {
            if (s.parent_id === parentId && !toRemove.has(s.id)) {
              toRemove.add(s.id)
              queue.push(s.id)
            }
          }
        }
        setSources(prev => prev.filter(s => !toRemove.has(s.id)))
      } else {
        // Reparent: update children's parent_id to the deleted source's parent
        const deleted = sources.find(s => s.id === sourceId)
        setSources(prev => prev
          .filter(s => s.id !== sourceId)
          .map(s => s.parent_id === sourceId
            ? { ...s, parent_id: deleted?.parent_id ?? null }
            : s
          )
        )
      }
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete source')
      return false
    }
  }, [projectId, sources])

  const addSourceFn = useCallback(async (data: FormData | Record<string, unknown>): Promise<KnowledgeSourceWithCodebase | null> => {
    try {
      const payload = await addKnowledgeSource(projectId, data)
      const source = payload.source as KnowledgeSourceWithCodebase

      setSources(prev => [source, ...prev])

      return source
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add source')
      return null
    }
  }, [projectId])

  return useMemo(
    () => ({ sources, isLoading, error, refresh: fetchSources, updateSource: updateSourceFn, deleteSource: deleteSourceFn, addSource: addSourceFn }),
    [sources, isLoading, error, fetchSources, updateSourceFn, deleteSourceFn, addSourceFn]
  )
}
