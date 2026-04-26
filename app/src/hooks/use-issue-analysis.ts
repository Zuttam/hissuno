'use client'

import { useState, useCallback, useRef } from 'react'
import {
  startAnalysis as apiStartAnalysis,
  cancelAnalysis as apiCancelAnalysis,
  issueAnalyzeStreamUrl,
} from '@/lib/api/issues'

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

/**
 * Map the new automation-runner SSE shape onto the legacy event types this
 * UI was built around. Returns `null` for events the UI doesn't render
 * (snapshots, raw output payloads).
 */
function translateAutomationEvent(raw: {
  type: string
  message?: string
  data?: Record<string, unknown>
  timestamp: string
}): AnalysisEvent | null {
  switch (raw.type) {
    case 'run-start':
      return {
        type: 'workflow-start',
        message: raw.message,
        data: raw.data,
        timestamp: raw.timestamp,
      }
    case 'progress':
      return {
        type: 'step-progress',
        message: raw.message,
        data: raw.data,
        timestamp: raw.timestamp,
      }
    case 'run-finish':
      return {
        type: 'workflow-finish',
        message: raw.message,
        data: raw.data,
        timestamp: raw.timestamp,
      }
    case 'final': {
      const status = (raw.data?.status as string | undefined) ?? 'succeeded'
      if (status === 'succeeded') {
        return {
          type: 'workflow-finish',
          message: raw.message,
          data: raw.data,
          timestamp: raw.timestamp,
        }
      }
      return {
        type: 'error',
        message: raw.message ?? `Analysis ${status}`,
        data: raw.data,
        timestamp: raw.timestamp,
      }
    }
    case 'error':
      return {
        type: 'error',
        message: raw.message ?? 'Analysis failed',
        data: raw.data,
        timestamp: raw.timestamp,
      }
    case 'snapshot':
    case 'output':
      // Useful telemetry but not a UI step. Drop silently.
      return null
    default:
      return null
  }
}

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
      const eventSource = new EventSource(issueAnalyzeStreamUrl(projectId, issueId, runId))
      eventSourceRef.current = eventSource
      resetConnectionTimeout()

      eventSource.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data) as { type: string; message?: string; data?: Record<string, unknown>; timestamp: string }
          resetConnectionTimeout()

          if (raw.type === 'heartbeat') return

          // Translate the new automation-runner event shape into the legacy
          // step-based UI shape so the existing progress UI keeps working.
          // New types: run-start, progress, run-finish, snapshot, output,
          // final, error. Old types this UI expects: workflow-start,
          // step-start, step-progress, step-finish, workflow-finish, error.
          const translated = translateAutomationEvent(raw)
          if (!translated) return

          setEvents((prev) => [...prev, translated])

          if (translated.type === 'workflow-start' && translated.data?.totalSteps) {
            setTotalSteps(translated.data.totalSteps as number)
          }

          if (translated.type === 'step-progress') {
            // Treat each progress message as a fresh step boundary so the
            // existing UI advances. The new model is phase-based, not
            // step-based — matching exact step counts isn't meaningful.
            setCompletedSteps((prev) => prev + 1)
          }

          if (translated.type === 'workflow-finish' || translated.type === 'error') {
            cleanup()
            setTimeout(() => {
              setIsAnalyzing(false)
              if (translated.type === 'workflow-finish') {
                onComplete?.()
              } else if (translated.type === 'error') {
                setError(translated.message ?? 'Analysis failed')
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
      const result = await apiStartAnalysis(projectId, issueId)
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

  const cancelAnalysisFn = useCallback(async () => {
    setError(null)

    try {
      await apiCancelAnalysis(projectId, issueId)

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
    cancelAnalysis: cancelAnalysisFn,
  }
}
