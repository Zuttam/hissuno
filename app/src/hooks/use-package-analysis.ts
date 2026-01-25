'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AnalysisEvent } from '@/components/projects/knowledge/analysis-progress-bar'

interface UsePackageAnalysisOptions {
  projectId: string
  packageId: string | null
  /** Called when analysis completes (successfully or with errors) */
  onAnalysisComplete?: () => void
  /** Check for running analysis on mount and auto-connect */
  checkOnMount?: boolean
}

interface UsePackageAnalysisState {
  isAnalyzing: boolean
  events: AnalysisEvent[]
  error: string | null
  /** Trigger analysis. Optionally pass a packageId to override the hook's packageId */
  triggerAnalysis: (overridePackageId?: string) => Promise<void>
  cancelAnalysis: () => Promise<void>
}

/**
 * Hook for managing package-specific knowledge analysis with SSE streaming support.
 */
export function usePackageAnalysis({
  projectId,
  packageId,
  onAnalysisComplete,
  checkOnMount = false,
}: UsePackageAnalysisOptions): UsePackageAnalysisState {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [events, setEvents] = useState<AnalysisEvent[]>([])
  const [error, setError] = useState<string | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)
  const mountedRef = useRef(true)
  const onAnalysisCompleteRef = useRef(onAnalysisComplete)

  // Keep callback ref up to date
  useEffect(() => {
    onAnalysisCompleteRef.current = onAnalysisComplete
  }, [onAnalysisComplete])

  // Connect to SSE stream for real-time updates
  const connectToStream = useCallback((targetPackageId?: string) => {
    const pkgId = targetPackageId ?? packageId
    if (!pkgId) return

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
        message: 'Package analysis started',
        timestamp: new Date().toISOString(),
      },
    ])

    try {
      const eventSource = new EventSource(
        `/api/projects/${projectId}/knowledge/packages/${pkgId}/analyze/stream`
      )
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
              onAnalysisCompleteRef.current?.()
            }, 1000)
          }
        } catch (err) {
          console.error('[usePackageAnalysis] Failed to parse SSE event:', err)
        }
      }

      eventSource.onerror = () => {
        // Only clean up if the connection is actually closed
        if (eventSource.readyState === EventSource.CLOSED) {
          eventSourceRef.current = null
        }
      }
    } catch (err) {
      console.warn('[usePackageAnalysis] Failed to create EventSource', err)
    }
  }, [projectId, packageId])

  // Trigger new analysis
  const triggerAnalysis = useCallback(async (overridePackageId?: string) => {
    const pkgId = overridePackageId ?? packageId
    if (isAnalyzing || !pkgId) return

    setError(null)
    setIsAnalyzing(true)
    setEvents([])

    try {
      const response = await fetch(
        `/api/projects/${projectId}/knowledge/packages/${pkgId}/analyze`,
        { method: 'POST' }
      )

      if (!response.ok) {
        const data = await response.json()
        if (response.status === 409) {
          // Already running - just connect to stream
          connectToStream(pkgId)
          return
        }
        throw new Error(data.error ?? 'Failed to start analysis')
      }

      // Connect to SSE stream for real-time updates
      connectToStream(pkgId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start analysis'
      setError(message)
      setIsAnalyzing(false)
    }
  }, [projectId, packageId, isAnalyzing, connectToStream])

  // Cancel running analysis
  const cancelAnalysis = useCallback(async () => {
    if (!packageId) return

    setError(null)

    try {
      const cancelResponse = await fetch(
        `/api/projects/${projectId}/knowledge/packages/${packageId}/analyze/cancel`,
        { method: 'POST' }
      )

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
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel analysis'
      setError(message)
    }
  }, [projectId, packageId])

  // Check for running analysis on mount
  useEffect(() => {
    if (!checkOnMount || !packageId) return

    const checkStatus = async () => {
      try {
        const response = await fetch(
          `/api/projects/${projectId}/knowledge/packages/${packageId}/analyze`
        )
        if (!response.ok) return

        const data = await response.json()
        if (data.isRunning && mountedRef.current) {
          // Analysis is already running, connect to stream
          setIsAnalyzing(true)
          setEvents([
            {
              type: 'workflow-start',
              message: 'Reconnecting to running analysis...',
              timestamp: new Date().toISOString(),
            },
          ])
          connectToStream()
        }
      } catch (err) {
        console.warn('[usePackageAnalysis] Failed to check status:', err)
      }
    }

    void checkStatus()
  }, [checkOnMount, packageId, projectId, connectToStream])

  // Cleanup SSE connection on unmount
  useEffect(() => {
    mountedRef.current = true

    return () => {
      mountedRef.current = false
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [])

  return useMemo(
    () => ({
      isAnalyzing,
      events,
      error,
      triggerAnalysis,
      cancelAnalysis,
    }),
    [isAnalyzing, events, error, triggerAnalysis, cancelAnalysis]
  )
}
