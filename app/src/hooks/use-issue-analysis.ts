'use client'

import { useState, useCallback, useRef } from 'react'

export interface AnalysisEvent {
  type: 'connected' | 'workflow-start' | 'step-start' | 'step-progress' | 'step-finish' | 'workflow-finish' | 'heartbeat' | 'error'
  stepId?: string
  stepName?: string
  message?: string
  data?: {
    runId?: string
    totalSteps?: number
    [key: string]: unknown
  }
  timestamp: string
}

interface UseIssueAnalysisOptions {
  projectId: string
  issueId: string
  onComplete?: () => void
}

interface UseIssueAnalysisReturn {
  isAnalyzing: boolean
  events: AnalysisEvent[]
  error: string | null
  totalSteps: number
  completedSteps: number
  startAnalysis: () => Promise<void>
  cancelAnalysis: () => Promise<void>
}

const CONNECTION_TIMEOUT_MS = 60_000

export function useIssueAnalysis({
  projectId,
  issueId,
  onComplete,
}: UseIssueAnalysisOptions): UseIssueAnalysisReturn {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [events, setEvents] = useState<AnalysisEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const [totalSteps, setTotalSteps] = useState(0)
  const [completedSteps, setCompletedSteps] = useState(0)
  const eventSourceRef = useRef<EventSource | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const clearConnectionTimeout = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const resetConnectionTimeout = useCallback(() => {
    clearConnectionTimeout()
    timeoutRef.current = setTimeout(() => {
      console.error('[useIssueAnalysis] Connection timeout')
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
      setIsAnalyzing(false)
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

  const connectToStream = useCallback((runId: string) => {
    cleanup()
    setEvents([])
    setTotalSteps(0)
    setCompletedSteps(0)

    try {
      const eventSource = new EventSource(
        `/api/projects/${projectId}/issues/${issueId}/analyze/stream?runId=${runId}`
      )
      eventSourceRef.current = eventSource
      resetConnectionTimeout()

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as AnalysisEvent
          resetConnectionTimeout()

          if (data.type === 'heartbeat') return

          setEvents((prev) => [...prev, data])

          if (data.type === 'workflow-start' && data.data?.totalSteps) {
            setTotalSteps(data.data.totalSteps as number)
          }

          if (data.type === 'step-finish') {
            setCompletedSteps((prev) => prev + 1)
          }

          if (data.type === 'workflow-finish' || data.type === 'error') {
            cleanup()
            setTimeout(() => {
              setIsAnalyzing(false)
              if (data.type === 'workflow-finish') {
                onComplete?.()
              } else if (data.type === 'error') {
                setError(data.message ?? 'Analysis failed')
              }
            }, 500)
          }
        } catch (err) {
          console.error('[useIssueAnalysis] Failed to parse SSE event:', err)
        }
      }

      eventSource.onerror = () => {
        if (eventSource.readyState === EventSource.CLOSED) {
          cleanup()
          setIsAnalyzing(false)
        }
      }
    } catch (err) {
      console.error('[useIssueAnalysis] Failed to create EventSource:', err)
      cleanup()
      setIsAnalyzing(false)
      setError('Failed to connect to server.')
    }
  }, [projectId, issueId, onComplete, cleanup, resetConnectionTimeout])

  const startAnalysis = useCallback(async () => {
    setError(null)
    setIsAnalyzing(true)
    setEvents([])
    setTotalSteps(0)
    setCompletedSteps(0)

    try {
      const response = await fetch(
        `/api/projects/${projectId}/issues/${issueId}/analyze`,
        { method: 'POST' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Failed to start analysis')
      }

      const result = await response.json()
      const runId = result.runId

      if (!runId) {
        throw new Error('No runId returned from analysis start')
      }

      connectToStream(runId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start analysis'
      setError(message)
      setIsAnalyzing(false)
    }
  }, [projectId, issueId, connectToStream])

  const cancelAnalysis = useCallback(async () => {
    setError(null)

    try {
      const response = await fetch(
        `/api/projects/${projectId}/issues/${issueId}/analyze/cancel`,
        { method: 'POST' }
      )

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error ?? 'Failed to cancel')
      }

      cleanup()
      setIsAnalyzing(false)
      setEvents([])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel'
      setError(message)
    }
  }, [projectId, issueId, cleanup])

  return {
    isAnalyzing,
    events,
    error,
    totalSteps,
    completedSteps,
    startAnalysis,
    cancelAnalysis,
  }
}
