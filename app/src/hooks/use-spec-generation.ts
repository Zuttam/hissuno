'use client'

import { useState, useCallback, useRef } from 'react'

export interface SpecGenerationEvent {
  type: 'connected' | 'workflow-start' | 'step-start' | 'step-progress' | 'step-finish' | 'text-chunk' | 'tool-start' | 'tool-finish' | 'workflow-finish' | 'error'
  stepId?: string
  stepName?: string
  message?: string
  data?: {
    content?: string      // For text-chunk events
    toolName?: string     // For tool-start/tool-finish events
    args?: unknown        // For tool-start events
    result?: unknown      // For tool-finish events
    runId?: string        // For workflow-start events
    totalSteps?: number   // For workflow-start events
    [key: string]: unknown
  }
  timestamp: string
}

interface UseSpecGenerationOptions {
  issueId: string
  /** Called when spec generation completes successfully */
  onComplete?: () => void
}

interface UseSpecGenerationReturn {
  isGenerating: boolean
  events: SpecGenerationEvent[]
  error: string | null
  streamedText: string
  activeTools: string[]
  totalSteps: number
  completedSteps: number
  startGeneration: () => Promise<void>
  cancelGeneration: () => Promise<void>
}

export function useSpecGeneration({
  issueId,
  onComplete,
}: UseSpecGenerationOptions): UseSpecGenerationReturn {
  const [isGenerating, setIsGenerating] = useState(false)
  const [events, setEvents] = useState<SpecGenerationEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [streamedText, setStreamedText] = useState('')
  const [activeTools, setActiveTools] = useState<string[]>([])
  const [totalSteps, setTotalSteps] = useState(0)
  const [completedSteps, setCompletedSteps] = useState(0)
  const eventSourceRef = useRef<EventSource | null>(null)

  // Connect to SSE stream with specific runId
  const connectToStream = useCallback((runId: string) => {
    // Close existing connection if any
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    // Clear previous state - no synthetic events, server sends all events
    setEvents([])
    setStreamedText('')
    setActiveTools([])
    setTotalSteps(0)
    setCompletedSteps(0)

    try {
      // Include runId in the stream URL
      const eventSource = new EventSource(
        `/api/issues/${issueId}/generate-spec/stream?runId=${runId}`
      )
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as SpecGenerationEvent
          setEvents((prev) => [...prev, data])

          // Handle workflow-start - get total steps
          if (data.type === 'workflow-start' && data.data?.totalSteps) {
            setTotalSteps(data.data.totalSteps as number)
          }

          // Handle step-finish - increment completed steps
          if (data.type === 'step-finish') {
            setCompletedSteps((prev) => prev + 1)
          }

          // Handle text chunks - accumulate streamed text
          if (data.type === 'text-chunk' && data.data?.content) {
            setStreamedText((prev) => prev + data.data!.content)
          }

          // Handle tool events
          if (data.type === 'tool-start' && data.data?.toolName) {
            setActiveTools((prev) => [...prev, data.data!.toolName!])
          }
          if (data.type === 'tool-finish' && data.data?.toolName) {
            setActiveTools((prev) => prev.filter(t => t !== data.data!.toolName))
          }

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
  }, [issueId, onComplete])

  // Start spec generation
  const startGeneration = useCallback(async () => {
    setError(null)
    setIsGenerating(true)
    setEvents([])
    setStreamedText('')
    setActiveTools([])
    setTotalSteps(0)
    setCompletedSteps(0)

    try {
      const response = await fetch(
        `/api/issues/${issueId}/generate-spec`,
        { method: 'POST' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Failed to start spec generation')
      }

      // Get runId from response to use for stream connection
      const result = await response.json()
      const runId = result.runId

      if (!runId) {
        throw new Error('No runId returned from spec generation start')
      }

      // Connect to SSE stream with the specific runId
      connectToStream(runId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start spec generation'
      setError(message)
      setIsGenerating(false)
    }
  }, [issueId, connectToStream])

  // Cancel spec generation
  const cancelGeneration = useCallback(async () => {
    setError(null)

    try {
      const response = await fetch(
        `/api/issues/${issueId}/generate-spec/cancel`,
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
  }, [issueId])

  return {
    isGenerating,
    events,
    error,
    streamedText,
    activeTools,
    totalSteps,
    completedSteps,
    startGeneration,
    cancelGeneration,
  }
}
