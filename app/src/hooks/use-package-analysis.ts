'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AnalysisEvent } from '@/components/projects/knowledge/analysis-progress-bar'
import {
  getPackageAnalysisStatus,
  triggerPackageAnalysis,
  cancelPackageAnalysis,
  packageAnalyzeStreamUrl,
} from '@/lib/api/knowledge'

/**
 * Map the new automation-runner SSE shape onto the legacy step-based
 * AnalysisEvent shape so the existing progress UI keeps working. Returns
 * `null` for events the UI doesn't render (snapshots, raw output payloads).
 */
function translateAutomationEvent(raw: {
  type: string
  message?: string
  data?: Record<string, unknown>
  timestamp: string
}): AnalysisEvent | null {
  switch (raw.type) {
    case 'run-start':
      return { type: 'workflow-start', message: raw.message, data: raw.data, timestamp: raw.timestamp }
    case 'progress':
      return { type: 'step-progress', message: raw.message, data: raw.data, timestamp: raw.timestamp }
    case 'run-finish':
      return { type: 'workflow-finish', message: raw.message, data: raw.data, timestamp: raw.timestamp }
    case 'final': {
      const status = (raw.data?.status as string | undefined) ?? 'succeeded'
      if (status === 'succeeded') {
        return { type: 'workflow-finish', message: raw.message, data: raw.data, timestamp: raw.timestamp }
      }
      return {
        type: 'error',
        message: raw.message ?? `Compile ${status}`,
        data: raw.data,
        timestamp: raw.timestamp,
      }
    }
    case 'cancelled':
      return {
        type: 'error',
        message: raw.message ?? 'Compile cancelled',
        data: raw.data,
        timestamp: raw.timestamp,
      }
    case 'error':
      return {
        type: 'error',
        message: raw.message ?? 'Compile failed',
        data: raw.data,
        timestamp: raw.timestamp,
      }
    case 'snapshot':
    case 'output':
      return null
    default:
      return null
  }
}

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
  const currentRunIdRef = useRef<string | null>(null)

  // Keep callback ref up to date
  useEffect(() => {
    onAnalysisCompleteRef.current = onAnalysisComplete
  }, [onAnalysisComplete])

  // Connect to SSE stream for real-time updates. Translates the new
  // automation-runner SSE shape onto the legacy step-based AnalysisEvent
  // shape so the existing progress UI keeps rendering.
  const connectToStream = useCallback((runId: string) => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    setEvents([
      {
        type: 'workflow-start',
        message: 'Package analysis started',
        timestamp: new Date().toISOString(),
      },
    ])

    try {
      const eventSource = new EventSource(packageAnalyzeStreamUrl(projectId, runId))
      eventSourceRef.current = eventSource

      eventSource.onmessage = (event) => {
        if (!mountedRef.current) return

        try {
          const raw = JSON.parse(event.data) as {
            type: string
            message?: string
            data?: Record<string, unknown>
            timestamp: string
          }
          const translated = translateAutomationEvent(raw)
          if (!translated) return

          setEvents((prev) => [...prev, translated])

          if (translated.type === 'workflow-finish' || translated.type === 'error') {
            eventSource.close()
            eventSourceRef.current = null

            setTimeout(() => {
              if (!mountedRef.current) return
              setIsAnalyzing(false)
              currentRunIdRef.current = null
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
          if (mountedRef.current) {
            setIsAnalyzing(false)
            currentRunIdRef.current = null
            onAnalysisCompleteRef.current?.()
          }
        }
      }
    } catch (err) {
      console.warn('[usePackageAnalysis] Failed to create EventSource', err)
    }
  }, [projectId])

  // Trigger a new compile via the automation runner. POST returns a runId;
  // connect the SSE stream to that runId.
  const triggerAnalysisFn = useCallback(async (overridePackageId?: string) => {
    const pkgId = overridePackageId ?? packageId
    if (isAnalyzing || !pkgId) return

    setError(null)
    setIsAnalyzing(true)
    setEvents([])

    try {
      const response = await triggerPackageAnalysis(projectId, pkgId)
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error((data as { error?: string }).error ?? 'Failed to start analysis')
      }
      const data = (await response.json()) as { runId?: string }
      if (!data.runId) {
        throw new Error('No runId returned from analysis start')
      }

      currentRunIdRef.current = data.runId
      connectToStream(data.runId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start analysis'
      setError(message)
      setIsAnalyzing(false)
    }
  }, [projectId, packageId, isAnalyzing, connectToStream])

  // Cancel a running compile via the automation runner.
  const cancelAnalysisFn = useCallback(async () => {
    if (!packageId) return
    const runId = currentRunIdRef.current

    setError(null)

    try {
      await cancelPackageAnalysis(projectId, packageId, runId ?? undefined)

      setEvents([])
      setIsAnalyzing(false)
      currentRunIdRef.current = null

      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to cancel analysis'
      setError(message)
    }
  }, [projectId, packageId])

  // Reconnect-on-mount is a no-op until the automation runner exposes
  // "is there a running run for this entity?" Query automation_runs by skill
  // + entity if/when we want this back.
  useEffect(() => {
    if (!checkOnMount || !packageId) return
    void getPackageAnalysisStatus(projectId, packageId)
  }, [checkOnMount, packageId, projectId])

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
