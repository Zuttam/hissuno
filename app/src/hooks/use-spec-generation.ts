'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

export interface SpecGenerationEvent {
  type: 'connected' | 'step-start' | 'step-progress' | 'step-finish' | 'workflow-finish' | 'error'
  stepId?: string
  stepName?: string
  message?: string
  data?: Record<string, unknown>
  timestamp: string
}

interface SpecGenerationStatus {
  isRunning: boolean
  status: 'idle' | 'running' | 'completed' | 'failed' | 'cancelled'
  specRunId?: string
  runId?: string
  startedAt?: string
  completedAt?: string
  errorMessage?: string
}

interface UseSpecGenerationOptions {
  projectId: string
  issueId: string
  /** Called when spec generation completes successfully */
  onComplete?: () => void
}

interface UseSpecGenerationReturn {
  isGenerating: boolean
  events: SpecGenerationEvent[]
  error: string | null
  startGeneration: () => Promise<void>
  cancelGeneration: () => Promise<void>
}

export function useSpecGeneration({
  projectId,
  issueId,
  onComplete,
}: UseSpecGenerationOptions): UseSpecGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false)
  const [events, setEvents] = useState<SpecGenerationEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Fetch current status
  const fetchStatus = useCallback(async (): Promise<SpecGenerationStatus | null> => {
    try {
      const response = await fetch(`/api/projects/${projectId}/issues/${issueId}/generate-spec`)
      if (!response.ok) return null
      return await response.json()
    } catch (err) {
      console.error('[useSpecGeneration] Failed to fetch status:', err)
      return null
    }
  }, [projectId, issueId])

  // Connect to SSE stream
  const connectToStream = useCallback(() => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    // Clear previous events and add synthetic start event
    setEvents([{
      type: 'step-start',
      stepId: 'init',
      message: 'Spec generation started',
      timestamp: new Date().toISOString(),
    }])

    try {
      const eventSource = new EventSource(
        `/api/projects/${projectId}/issues/${issueId}/generate-spec/stream`
      )
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as SpecGenerationEvent
          setEvents((prev) => [...prev, data])

          // Check for completion
          if (data.type === 'workflow-finish' || data.type === 'error') {
            eventSource.close()
            eventSourceRef.current = null

            // Give a small delay then update state
            setTimeout(() => {
              setIsGenerating(false)
              if (data.type === 'workflow-finish') {
                onComplete?.()
              } else if (data.type === 'error') {
                setError(data.message ?? 'Spec generation failed')
              }
            }, 500)
          }
        } catch (err) {
          console.error('[useSpecGeneration] Failed to parse SSE event:', err)
        }
      }

      eventSource.onerror = () => {
        // Only clean up if the connection is actually closed
        if (eventSource.readyState === EventSource.CLOSED) {
          eventSourceRef.current = null
        }
      }
    } catch (err) {
      console.error('[useSpecGeneration] Failed to create EventSource:', err)
    }
  }, [projectId, issueId, onComplete])

  // Check for running generation on mount
  useEffect(() => {
    const init = async () => {
      const status = await fetchStatus()
      if (status?.isRunning) {
        setIsGenerating(true)
        // Add a synthetic event if we reconnect to an in-progress generation
        setEvents([{
          type: 'step-start',
          stepId: 'reconnect',
          message: 'Spec generation in progress...',
          timestamp: status.startedAt ?? new Date().toISOString(),
        }])
        connectToStream()
      }
    }

    void init()

    // Cleanup SSE connection on unmount
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [fetchStatus, connectToStream])

  // Start spec generation
  const startGeneration = useCallback(async () => {
    setError(null)
    setIsGenerating(true)
    setEvents([])

    try {
      const response = await fetch(
        `/api/projects/${projectId}/issues/${issueId}/generate-spec`,
        { method: 'POST' }
      )

      if (!response.ok) {
        const data = await response.json()
        // Handle 409 Conflict (already running)
        if (response.status === 409) {
          connectToStream()
          return
        }
        throw new Error(data.error ?? 'Failed to start spec generation')
      }

      // Connect to SSE stream for real-time updates
      connectToStream()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start spec generation'
      setError(message)
      setIsGenerating(false)
    }
  }, [projectId, issueId, connectToStream])

  // Cancel spec generation
  const cancelGeneration = useCallback(async () => {
    setError(null)

    try {
      const response = await fetch(
        `/api/projects/${projectId}/issues/${issueId}/generate-spec/cancel`,
        { method: 'POST' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Failed to cancel')
      }

      // Close the EventSource
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }

      setIsGenerating(false)
      setEvents([])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel'
      setError(message)
    }
  }, [projectId, issueId])

  return {
    isGenerating,
    events,
    error,
    startGeneration,
    cancelGeneration,
  }
}
