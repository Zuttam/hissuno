'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  PMReviewResult,
  PMReviewSSEEvent,
  PMReviewStatusResponse,
} from '@/types/issue'

interface UsePMReviewOptions {
  sessionId: string | null
}

interface UsePMReviewState {
  isReviewing: boolean
  events: PMReviewSSEEvent[]
  result: PMReviewResult | null
  error: string | null
  currentStep: string | null
  triggerReview: () => Promise<void>
  refresh: () => Promise<void>
}

/**
 * Hook for managing PM review with SSE streaming support.
 * Automatically reconnects to running reviews on mount/page refresh.
 */
export function usePMReview({ sessionId }: UsePMReviewOptions): UsePMReviewState {
  const [isReviewing, setIsReviewing] = useState(false)
  const [events, setEvents] = useState<PMReviewSSEEvent[]>([])
  const [result, setResult] = useState<PMReviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [currentStep, setCurrentStep] = useState<string | null>(null)
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

    const eventSource = new EventSource(`/api/sessions/${sessionId}/pm-review/stream`)
    eventSourceRef.current = eventSource

    eventSource.onmessage = (event) => {
      if (!mountedRef.current) return

      try {
        const data = JSON.parse(event.data) as PMReviewSSEEvent
        setEvents((prev) => [...prev, data])

        // Track current step
        if (data.type === 'step-start') {
          setCurrentStep(data.stepName ?? null)
        } else if (data.type === 'step-finish') {
          setCurrentStep(null)
        }

        // Handle completion
        if (data.type === 'review-finish') {
          eventSource.close()
          eventSourceRef.current = null
          setIsReviewing(false)
          setCurrentStep(null)
          if (data.result) {
            setResult(data.result)
          }
        }

        // Handle error
        if (data.type === 'error') {
          eventSource.close()
          eventSourceRef.current = null
          setIsReviewing(false)
          setCurrentStep(null)
          setError(data.message ?? 'Review failed')
        }
      } catch (err) {
        console.error('[usePMReview] Failed to parse SSE event:', err)
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
      return
    }

    try {
      const response = await fetch(`/api/sessions/${sessionId}/pm-review`)
      if (!response.ok) return

      const data = (await response.json()) as PMReviewStatusResponse

      if (data.isRunning) {
        setIsReviewing(true)
        // Connect to stream if running
        connectToStream()
      } else if (data.result) {
        setResult(data.result)
        setIsReviewing(false)
      } else if (data.error) {
        setError(data.error)
        setIsReviewing(false)
      }
    } catch (err) {
      console.error('[usePMReview] Failed to fetch status:', err)
    }
  }, [sessionId, connectToStream])

  // Trigger new review
  const triggerReview = useCallback(async () => {
    if (!sessionId || isReviewing) return

    setError(null)
    setResult(null)
    setEvents([])
    setIsReviewing(true)

    try {
      const response = await fetch(`/api/sessions/${sessionId}/pm-review`, {
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
      currentStep,
      triggerReview,
      refresh: fetchStatus,
    }),
    [isReviewing, events, result, error, currentStep, triggerReview, fetchStatus]
  )
}
