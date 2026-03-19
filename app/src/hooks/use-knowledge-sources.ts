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
  deleteSource: (sourceId: string) => Promise<boolean>
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

  const deleteSourceFn = useCallback(async (sourceId: string): Promise<boolean> => {
    try {
      await deleteKnowledgeSource(projectId, sourceId)
      setSources(prev => prev.filter(s => s.id !== sourceId))
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete source')
      return false
    }
  }, [projectId])

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
