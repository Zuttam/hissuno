'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SessionTag } from '@/types/session'
import {
  getSessionReviewStatus,
  triggerSessionReview,
  sessionReviewStreamUrl,
} from '@/lib/api/sessions'

export type SessionReviewSSEEventType =
  | 'connected'
  | 'review-start'
  | 'graph-eval-start'
  | 'graph-eval-progress'
  | 'graph-eval-finish'
  | 'review-finish'
  | 'error'

export interface SessionReviewSSEEvent {
  type: SessionReviewSSEEventType
  stepId?: string
  stepName?: string
  message?: string
  tags?: SessionTag[]
  result?: SessionReviewResult
  timestamp: string
}

export interface WorkflowStep {
  id: string
  name: string
  status: 'pending' | 'running' | 'completed' | 'error'
  message?: string
  data?: Record<string, unknown>
}

const INITIAL_WORKFLOW_STEPS: WorkflowStep[] = [
  { id: 'graph-eval', name: 'Graph Evaluation', status: 'pending' },
]

export interface SessionReviewResult {
  // Classification
  tags: SessionTag[]
  tagsApplied: boolean
  // PM Review
  action: 'created' | 'linked' | 'skipped'
  issueId?: string
  issueName?: string
  issueResults?: Array<{
    action: 'created' | 'linked' | 'skipped'
    issueId?: string
    issueName?: string
  }>
  skipReason?: string
}

export interface SessionReviewStatusResponse {
  isRunning: boolean
  reviewId: string | null
  runId: string | null
  status: 'running' | 'completed' | 'failed' | 'skipped' | null
  startedAt: string | null
  completedAt: string | null
  result: SessionReviewResult | null
  error: string | null
}

interface UseSessionReviewOptions {
  projectId: string | null
  sessionId: string | null
}

interface UseSessionReviewState {
  isReviewing: boolean
  result: SessionReviewResult | null
  error: string | null
  tags: SessionTag[]
  steps: WorkflowStep[]
  currentStepId: string | null
  triggerReview: () => Promise<void>
  refresh: () => Promise<void>
}

export function useSessionReview({ projectId, sessionId }: UseSessionReviewOptions): UseSessionReviewState {
  const [isReviewing, setIsReviewing] = useState(false)
  const [result, setResult] = useState<SessionReviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tags, setTags] = useState<SessionTag[]>([])
  const [steps, setSteps] = useState<WorkflowStep[]>(INITIAL_WORKFLOW_STEPS)
  const [currentStepId, setCurrentStepId] = useState<string | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)
  const mountedRef = useRef(true)

  // Helper to reset steps to initial state
  const resetSteps = useCallback(() => {
    setSteps(INITIAL_WORKFLOW_STEPS)
    setCurrentStepId(null)
  }, [])

  // Connect to SSE stream
  const connectToStream = useCallback(() => {
    if (!projectId || !sessionId) return

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setError(null)
    resetSteps()

    const eventSource = new EventSource(sessionReviewStreamUrl(projectId, sessionId))
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      if (!mountedRef.current) return

      try {
        const data = JSON.parse(event.data) as SessionReviewSSEEvent
        // Process event (no accumulation needed - steps track progress)

        // Map event type to step ID for step tracking
        const eventTypeToStepId: Record<string, string> = {
          'graph-eval-start': 'graph-eval',
          'graph-eval-progress': 'graph-eval',
          'graph-eval-finish': 'graph-eval',
        }

        const stepId = eventTypeToStepId[data.type]

        // Track step status
        if (data.type.endsWith('-start') && stepId) {
          setCurrentStepId(stepId)
          setSteps((prev) =>
            prev.map((s) => (s.id === stepId ? { ...s, status: 'running' as const, message: data.message } : s))
          )
        } else if (data.type.endsWith('-progress') && stepId) {
          setSteps((prev) =>
            prev.map((s) => (s.id === stepId ? { ...s, message: data.message } : s))
          )
        } else if (data.type.endsWith('-finish') && stepId) {
          setSteps((prev) =>
            prev.map((s) =>
              s.id === stepId
                ? {
                    ...s,
                    status: 'completed' as const,
                    message: data.message,
                    data: {
                      tagCount: data.tags?.length,
                    },
                  }
                : s
            )
          )
        }

        // Handle completion
        if (data.type === 'review-finish') {
          eventSource.close()
          eventSourceRef.current = null
          setIsReviewing(false)
          setCurrentStepId(null)
          if (data.result) {
            setResult(data.result)
            setTags(data.result.tags || [])
          }
        }

        // Handle error
        if (data.type === 'error') {
          eventSource.close()
          eventSourceRef.current = null
          setIsReviewing(false)
          setCurrentStepId(null)
          setError(data.message ?? 'Review failed')
        }
      } catch (err) {
        console.error('[useSessionReview] Failed to parse SSE event:', err)
      }
    }

    eventSource.onerror = () => {
      if (!mountedRef.current) return

      // Only update state if connection was lost unexpectedly
      if (eventSource.readyState === EventSource.CLOSED) {
        eventSourceRef.current = null
        // Don't set error here - stream might have completed normally
      }
    }
  }, [projectId, sessionId, resetSteps])

  // Fetch current review status
  const fetchStatus = useCallback(async () => {
    if (!projectId || !sessionId) {
      setIsReviewing(false)
      setResult(null)
      setTags([])
      return
    }

    try {
      const data = await getSessionReviewStatus(projectId, sessionId)

      if (data.isRunning) {
        setIsReviewing(true)
        // Connect to stream if running
        connectToStream()
      } else if (data.status === 'skipped') {
        // Session was skipped (workflow not configured) — treat as not-yet-reviewed
        setIsReviewing(false)
      } else if (data.result) {
        setResult(data.result)
        setTags(data.result.tags || [])
        setIsReviewing(false)
      } else if (data.error) {
        setError(data.error)
        setIsReviewing(false)
      }
    } catch (err) {
      console.error('[useSessionReview] Failed to fetch status:', err)
    }
  }, [projectId, sessionId, connectToStream])

  // Trigger new review
  const triggerReviewFn = useCallback(async () => {
    if (!projectId || !sessionId || isReviewing) return

    setError(null)
    setResult(null)
    setTags([])
    resetSteps()
    setIsReviewing(true)

    try {
      const response = await triggerSessionReview(projectId, sessionId)

      const data = await response.json()

      if (!response.ok) {
        if (response.status === 409) {
          // Already running - connect to stream
          connectToStream()
          return
        }
        throw new Error(data.error ?? 'Failed to start review')
      }

      // Connect to SSE stream
      connectToStream()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start review')
      setIsReviewing(false)
    }
  }, [projectId, sessionId, isReviewing, connectToStream, resetSteps])

  // Check for running review on mount and when sessionId changes
  useEffect(() => {
    mountedRef.current = true
    void fetchStatus()

    return () => {
      mountedRef.current = false
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [fetchStatus])

  return useMemo(
    () => ({
      isReviewing,
      result,
      error,
      tags,
      steps,
      currentStepId,
      triggerReview: triggerReviewFn,
      refresh: fetchStatus,
    }),
    [isReviewing, result, error, tags, steps, currentStepId, triggerReviewFn, fetchStatus]
  )
}
