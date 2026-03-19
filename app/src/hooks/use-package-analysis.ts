'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AnalysisEvent } from '@/components/projects/knowledge/analysis-progress-bar'
import {
  getPackageAnalysisStatus,
  triggerPackageAnalysis,
  cancelPackageAnalysis,
  packageAnalyzeStreamUrl,
} from '@/lib/api/knowledge'

interface UsePackageAnalysisOptions {
  projectId: string
  packageId: string | null
  onAnalysisComplete?: () => void
  checkOnMount?: boolean
}

interface UsePackageAnalysisState {
  isAnalyzing: boolean
  events: AnalysisEvent[]
  error: string | null
  triggerAnalysis: (overridePackageId?: string) => Promise<void>
  cancelAnalysis: () => Promise<void>
}

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
      const eventSource = new EventSource(packageAnalyzeStreamUrl(projectId, pkgId))
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
        if (eventSource.readyState === EventSource.CLOSED) {
          eventSourceRef.current = null
          // If we never received a finish event, check if the analysis completed while we were disconnected
          if (mountedRef.current) {
            setIsAnalyzing(false)
            onAnalysisCompleteRef.current?.()
          }
        }
      }
    } catch (err) {
      console.warn('[usePackageAnalysis] Failed to create EventSource', err)
    }
  }, [projectId, packageId])

  // Trigger new analysis
  const triggerAnalysisFn = useCallback(async (overridePackageId?: string) => {
    const pkgId = overridePackageId ?? packageId
    if (isAnalyzing || !pkgId) return

    setError(null)
    setIsAnalyzing(true)
    setEvents([])

    try {
      const response = await triggerPackageAnalysis(projectId, pkgId)

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
  const cancelAnalysisFn = useCallback(async () => {
    if (!packageId) return

    setError(null)

    try {
      await cancelPackageAnalysis(projectId, packageId)

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
        const response = await getPackageAnalysisStatus(projectId, packageId)
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
      triggerAnalysis: triggerAnalysisFn,
      cancelAnalysis: cancelAnalysisFn,
    }),
    [isAnalyzing, events, error, triggerAnalysisFn, cancelAnalysisFn]
  )
}
