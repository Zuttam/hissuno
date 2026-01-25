'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AnalysisEvent } from '@/components/projects/knowledge/analysis-progress-bar'

/**
 * Analysis status response from API
 */
export interface AnalysisStatus {
  status: 'idle' | 'processing' | 'completed' | 'failed' | 'partial' | 'cancelled'
  isRunning?: boolean
  analysisId?: string | null
  runId?: string | null
  startedAt?: string | null
  completedAt?: string | null
  lastAnalysisStatus?: string | null
  lastAnalysisError?: string | null
  sources: {
    total: number
    pending: number
    processing: number
    completed: number
    failed: number
  }
  failedSources: Array<{ id: string; type: string; error: string | null }>
}

interface UseKnowledgeAnalysisOptions {
  projectId: string
  /** Called when analysis completes (successfully or with errors) */
  onAnalysisComplete?: () => void
}

interface UseKnowledgeAnalysisState {
  isAnalyzing: boolean
  events: AnalysisEvent[]
  status: AnalysisStatus | null
  error: string | null
  triggerAnalysis: () => Promise<void>
  cancelAnalysis: () => Promise<void>
  refresh: () => Promise<AnalysisStatus | null>
}

/**
 * Hook for managing knowledge analysis with SSE streaming support.
 * Handles analysis lifecycle, real-time progress events, and auto-reconnection.
 */
export function useKnowledgeAnalysis({
  projectId,
  onAnalysisComplete,
}: UseKnowledgeAnalysisOptions): UseKnowledgeAnalysisState {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [events, setEvents] = useState<AnalysisEvent[]>([])
  const [status, setStatus] = useState<AnalysisStatus | null>(null)
  const [error, setError] = useState<string | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)
  const mountedRef = useRef(true)
  const onAnalysisCompleteRef = useRef(onAnalysisComplete)

  // Keep callback ref up to date
  useEffect(() => {
    onAnalysisCompleteRef.current = onAnalysisComplete
  }, [onAnalysisComplete])

  // Fetch analysis status
  const fetchAnalysisStatus = useCallback(async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}/knowledge/analyze`)
      if (!response.ok) throw new Error('Failed to load status')
      const data = (await response.json()) as AnalysisStatus
      setStatus(data)

      // If analysis is already running, set state and add synthetic event for progress bar
      if (data.isRunning) {
        setIsAnalyzing(true)
        // Add a synthetic event if we don't have any events yet
        setEvents((prev) => {
          if (prev.length === 0) {
            return [
              {
                type: 'workflow-start',
                message: 'Knowledge analysis in progress...',
                timestamp: data.startedAt ?? new Date().toISOString(),
              },
            ]
          }
          return prev
        })
      }

      return data
    } catch (err) {
      console.error('[useKnowledgeAnalysis] Failed to fetch status:', err)
      return null
    }
  }, [projectId])

  // Connect to SSE stream for real-time updates
  const connectToStream = useCallback(() => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    // Clear previous events
    setEvents([])

    // Add a synthetic "started" event
    setEvents([
      {
        type: 'workflow-start',
        message: 'Knowledge analysis started',
        timestamp: new Date().toISOString(),
      },
    ])

    try {
      const eventSource = new EventSource(`/api/projects/${projectId}/knowledge/analyze/stream`)
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        if (!mountedRef.current) return

        try {
          const data = JSON.parse(event.data) as AnalysisEvent
          setEvents((prev) => [...prev, data])

          // Check for workflow completion
          if (data.type === 'workflow-finish' || data.type === 'error') {
            eventSource.close()
            eventSourceRef.current = null

            // Give a small delay then refresh data
            setTimeout(() => {
              if (!mountedRef.current) return
              setIsAnalyzing(false)
              void fetchAnalysisStatus()
              onAnalysisCompleteRef.current?.()
            }, 1000)
          }
        } catch (err) {
          console.error('[useKnowledgeAnalysis] Failed to parse SSE event:', err)
        }
      }

      eventSource.onerror = () => {
        // Only clean up if the connection is actually closed
        // EventSource will automatically reconnect for transient errors
        if (eventSource.readyState === EventSource.CLOSED) {
          eventSourceRef.current = null
        }
      }
    } catch (err) {
      // EventSource creation failed
      console.warn('[useKnowledgeAnalysis] Failed to create EventSource, falling back to polling', err)
    }
  }, [projectId, fetchAnalysisStatus])

  // Trigger new analysis
  const triggerAnalysis = useCallback(async () => {
    if (isAnalyzing) return

    setError(null)
    setIsAnalyzing(true)
    setEvents([]) // Clear previous events

    try {
      const response = await fetch(`/api/projects/${projectId}/knowledge/analyze`, {
        method: 'POST',
      })

      if (!response.ok) {
        const data = await response.json()
        // Handle 409 Conflict (already running)
        if (response.status === 409) {
          // Already running - just connect to stream
          connectToStream()
          return
        }
        throw new Error(data.error ?? 'Failed to start analysis')
      }

      // Connect to SSE stream for real-time updates
      connectToStream()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start analysis'
      setError(message)
      setIsAnalyzing(false)
    }
  }, [projectId, isAnalyzing, connectToStream])

  // Cancel running analysis
  const cancelAnalysis = useCallback(async () => {
    setError(null)

    try {
      const cancelResponse = await fetch(`/api/projects/${projectId}/knowledge/analyze/cancel`, {
        method: 'POST',
      })

      if (!cancelResponse.ok) {
        const data = await cancelResponse.json()
        throw new Error(data.error ?? 'Failed to cancel analysis')
      }

      // Clear events
      setEvents([])
      setIsAnalyzing(false)

      // Close existing SSE connection
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }

      // Refresh status
      await fetchAnalysisStatus()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel analysis'
      setError(message)
    }
  }, [projectId, fetchAnalysisStatus])

  // Check for running analysis on mount and connect to stream if needed
  useEffect(() => {
    mountedRef.current = true

    const init = async () => {
      const currentStatus = await fetchAnalysisStatus()
      if (currentStatus?.isRunning) {
        connectToStream()
      }
    }

    void init()

    // Cleanup SSE connection on unmount
    return () => {
      mountedRef.current = false
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [fetchAnalysisStatus, connectToStream])

  return useMemo(
    () => ({
      isAnalyzing,
      events,
      status,
      error,
      triggerAnalysis,
      cancelAnalysis,
      refresh: fetchAnalysisStatus,
    }),
    [isAnalyzing, events, status, error, triggerAnalysis, cancelAnalysis, fetchAnalysisStatus]
  )
}
