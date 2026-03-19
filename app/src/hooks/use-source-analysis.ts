'use client'

import { useState, useCallback, useRef } from 'react'
import type { AnalysisEvent } from '@/hooks/use-issue-analysis'
import {
  triggerSourceAnalysis,
  sourceAnalyzeStreamUrl,
} from '@/lib/api/knowledge'

interface UseSourceAnalysisOptions {
  projectId: string
  onComplete?: () => void
}

interface UseSourceAnalysisReturn {
  isAnalyzing: boolean
  analyzingSourceId: string | null
  events: AnalysisEvent[]
  error: string | null
  startAnalysis: (sourceId: string) => Promise<void>
  reconnectToStream: (sourceId: string) => void
}

const CONNECTION_TIMEOUT_MS = 120_000 // 2 minutes for source analysis (can be slow)

export function useSourceAnalysis({
  projectId,
  onComplete,
}: UseSourceAnalysisOptions): UseSourceAnalysisReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [analyzingSourceId, setAnalyzingSourceId] = useState<string | null>(null)
  const [events, setEvents] = useState<AnalysisEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearConnectionTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const resetConnectionTimeout = useCallback(() => {
    clearConnectionTimeout()
    timeoutRef.current = setTimeout(() => {
      console.error('[useSourceAnalysis] Connection timeout')
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      setIsAnalyzing(false)
      setAnalyzingSourceId(null)
      setError('Connection timeout. Please try again.')
    }, CONNECTION_TIMEOUT_MS)
  }, [clearConnectionTimeout])

  const cleanup = useCallback(() => {
    clearConnectionTimeout()
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [clearConnectionTimeout])

  const connectToStream = useCallback((sourceId: string) => {
    cleanup()
    setEvents([])

    try {
      const eventSource = new EventSource(sourceAnalyzeStreamUrl(projectId, sourceId))
      eventSourceRef.current = eventSource
      resetConnectionTimeout()

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as AnalysisEvent
          resetConnectionTimeout()

          if (data.type === 'heartbeat') return

          setEvents((prev) => [...prev, data])

          if (data.type === 'workflow-finish' || data.type === 'error') {
            cleanup()
            setTimeout(() => {
              setIsAnalyzing(false)
              setAnalyzingSourceId(null)
              if (data.type === 'workflow-finish') {
                onComplete?.()
              } else if (data.type === 'error') {
                setError(data.message ?? 'Analysis failed')
              }
            }, 500)
          }
        } catch (err) {
          console.error('[useSourceAnalysis] Failed to parse SSE event:', err)
        }
      }

      eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) {
          cleanup()
          setIsAnalyzing(false)
          setAnalyzingSourceId(null)
        }
      }
    } catch (err) {
      console.error('[useSourceAnalysis] Failed to create EventSource:', err)
      cleanup()
      setIsAnalyzing(false)
      setAnalyzingSourceId(null)
      setError('Failed to connect to server.')
    }
  }, [projectId, onComplete, cleanup, resetConnectionTimeout])

  const reconnectToStream = useCallback((sourceId: string) => {
    setError(null)
    setIsAnalyzing(true)
    setAnalyzingSourceId(sourceId)
    setEvents([])
    connectToStream(sourceId)
  }, [connectToStream])

  const startAnalysis = useCallback(async (sourceId: string) => {
    setError(null)
    setIsAnalyzing(true)
    setAnalyzingSourceId(sourceId)
    setEvents([])

    try {
      const response = await triggerSourceAnalysis(projectId, sourceId)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Failed to start analysis')
      }

      // Connect to the SSE stream which executes the workflow
      connectToStream(sourceId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start analysis'
      setError(message)
      setIsAnalyzing(false)
      setAnalyzingSourceId(null)
    }
  }, [projectId, connectToStream])

  return {
    isAnalyzing,
    analyzingSourceId,
    events,
    error,
    startAnalysis,
    reconnectToStream,
  }
}
