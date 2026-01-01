'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SessionTag } from '@/types/session'

/**
 * Session review SSE event types
 */
export type SessionReviewSSEEventType =
  | 'connected'
  | 'review-start'
  | 'classify-start'
  | 'classify-progress'
  | 'classify-finish'
  | 'pm-review-start'
  | 'pm-review-progress'
  | 'pm-review-finish'
  | 'review-finish'
  | 'error'

/**
 * Session review SSE event
 */
export interface SessionReviewSSEEvent {
  type: SessionReviewSSEEventType
  stepId?: string
  stepName?: string
  message?: string
  tags?: SessionTag[]
  result?: SessionReviewResult
  timestamp: string
}

/**
 * Combined result of session review (classification + PM review)
 */
export interface SessionReviewResult {
  // Classification
  tags: SessionTag[]
  tagsApplied: boolean
  // PM Review
  action: 'created' | 'upvoted' | 'skipped'
  issueId?: string
  issueTitle?: string
  skipReason?: string
  thresholdMet?: boolean
  specGenerated?: boolean
}

/**
 * Session review status response from API
 */
export interface SessionReviewStatusResponse {
  isRunning: boolean
  reviewId: string | null
  runId: string | null
  status: 'running' | 'completed' | 'failed' | null
  startedAt: string | null
  completedAt: string | null
  result: SessionReviewResult | null
  error: string | null
}

interface UseSessionReviewOptions {
  sessionId: string | null
}

interface UseSessionReviewState {
  isReviewing: boolean
  events: SessionReviewSSEEvent[]
  result: SessionReviewResult | null
  error: string | null
  currentPhase: 'classify' | 'pm-review' | null
  progressMessage: string | null
  tags: SessionTag[]
  triggerReview: () => Promise<void>
  refresh: () => Promise<void>
}

/**
 * Hook for managing session review with SSE streaming support.
 * Handles both classification and PM review phases.
 * Automatically reconnects to running reviews on mount/page refresh.
 */
export function useSessionReview({ sessionId }: UseSessionReviewOptions): UseSessionReviewState {
  const [isReviewing, setIsReviewing] = useState(false)
  const [events, setEvents] = useState<SessionReviewSSEEvent[]>([])
  const [result, setResult] = useState<SessionReviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentPhase, setCurrentPhase] = useState<'classify' | 'pm-review' | null>(null)
  const [progressMessage, setProgressMessage] = useState<string | null>(null)
  const [tags, setTags] = useState<SessionTag[]>([])
  const eventSourceRef = useRef<EventSource | null>(null)
  const mountedRef = useRef(true)

  // Connect to SSE stream
  const connectToStream = useCallback(() => {
    if (!sessionId) return

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }

    setEvents([])
    setError(null)
    setProgressMessage(null)

    const eventSource = new EventSource(`/api/sessions/${sessionId}/review/stream`)
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      if (!mountedRef.current) return

      try {
        const data = JSON.parse(event.data) as SessionReviewSSEEvent
        setEvents((prev) => [...prev, data])

        // Track current phase and progress
        if (data.type === 'classify-start') {
          setCurrentPhase('classify')
          setProgressMessage(data.message ?? 'Starting classification...')
        } else if (data.type === 'classify-progress') {
          setProgressMessage(data.message ?? 'Processing...')
        } else if (data.type === 'classify-finish') {
          setCurrentPhase(null)
          setProgressMessage(null)
          if (data.tags) {
            setTags(data.tags)
          }
        } else if (data.type === 'pm-review-start') {
          setCurrentPhase('pm-review')
          setProgressMessage(data.message ?? 'Starting PM review...')
        } else if (data.type === 'pm-review-progress') {
          setProgressMessage(data.message ?? 'Processing...')
        } else if (data.type === 'pm-review-finish') {
          setCurrentPhase(null)
          setProgressMessage(null)
        }

        // Handle completion
        if (data.type === 'review-finish') {
          eventSource.close()
          eventSourceRef.current = null
          setIsReviewing(false)
          setCurrentPhase(null)
          setProgressMessage(null)
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
          setCurrentPhase(null)
          setProgressMessage(null)
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
  }, [sessionId])

  // Fetch current review status
  const fetchStatus = useCallback(async () => {
    if (!sessionId) {
      setIsReviewing(false)
      setResult(null)
      setTags([])
      return
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}/review`)
      if (!response.ok) return

      const data = (await response.json()) as SessionReviewStatusResponse

      if (data.isRunning) {
        setIsReviewing(true)
        // Connect to stream if running
        connectToStream()
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
  }, [sessionId, connectToStream])

  // Trigger new review
  const triggerReview = useCallback(async () => {
    if (!sessionId || isReviewing) return

    setError(null)
    setResult(null)
    setEvents([])
    setTags([])
    setIsReviewing(true)

    try {
      const response = await fetch(`/api/sessions/${sessionId}/review`, {
        method: 'POST',
      })

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
  }, [sessionId, isReviewing, connectToStream])

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
      events,
      result,
      error,
      currentPhase,
      progressMessage,
      tags,
      triggerReview,
      refresh: fetchStatus,
    }),
    [isReviewing, events, result, error, currentPhase, progressMessage, tags, triggerReview, fetchStatus]
  )
}
