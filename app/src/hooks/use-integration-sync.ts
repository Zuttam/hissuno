'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  SyncFrequency,
  SyncMode,
  SyncFilterConfig,
  SyncProgress,
} from '@/lib/integrations/shared/sync-constants'

export interface UseIntegrationSyncConfig {
  projectId: string
  open: boolean
  fetchStatus: (projectId: string) => Promise<Response>
  updateSettings: (
    projectId: string,
    settings: { syncFrequency: SyncFrequency; filterConfig: Record<string, unknown> }
  ) => Promise<Response>
  syncUrl: (projectId: string, mode: string) => string
  itemNoun: string
  itemNounPlural: string
  hasSyncMode?: boolean
  onStatusChanged?: () => void
  buildFilterConfig?: (base: SyncFilterConfig) => Record<string, unknown>
  onStatusLoaded?: (data: Record<string, unknown>) => void
}

export interface UseIntegrationSyncReturn {
  status: Record<string, unknown>
  isLoading: boolean
  error: string | null
  setError: (err: string | null) => void
  successMessage: string | null
  setSuccessMessage: (msg: string | null) => void
  showResultLink: boolean
  syncFrequency: SyncFrequency
  setSyncFrequency: (f: SyncFrequency) => void
  fromDate: string
  setFromDate: (d: string) => void
  toDate: string
  setToDate: (d: string) => void
  syncMode: SyncMode
  setSyncMode: (m: SyncMode) => void
  isSyncing: boolean
  syncProgress: SyncProgress | null
  isUpdatingSettings: boolean
  refreshStatus: () => Promise<void>
  handleUpdateSettings: () => Promise<void>
  handleSync: () => Promise<void>
  handleStopSync: () => void
}

export function useIntegrationSync(config: UseIntegrationSyncConfig): UseIntegrationSyncReturn {
  const {
    projectId,
    open,
    fetchStatus: fetchStatusApi,
    updateSettings: updateSettingsApi,
    syncUrl,
    itemNoun,
    itemNounPlural,
    hasSyncMode = true,
    onStatusChanged,
    buildFilterConfig,
    onStatusLoaded,
  } = config

  const [status, setStatus] = useState<Record<string, unknown>>({ connected: false })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showResultLink, setShowResultLink] = useState(false)

  const [syncFrequency, setSyncFrequency] = useState<SyncFrequency>('manual')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [syncMode, setSyncMode] = useState<SyncMode>('incremental')

  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)

  const refreshStatus = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetchStatusApi(projectId)
      if (!response.ok) {
        throw new Error('Failed to load integration status')
      }
      const data = await response.json()
      setStatus(data)

      if (data.filterConfig) {
        setFromDate(data.filterConfig.fromDate || '')
        setToDate(data.filterConfig.toDate || '')
      }
      if (data.syncFrequency) {
        setSyncFrequency(data.syncFrequency)
      }

      onStatusLoaded?.(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load integration status')
    } finally {
      setIsLoading(false)
    }
  }, [projectId, fetchStatusApi, onStatusLoaded])

  useEffect(() => {
    if (open) {
      void refreshStatus()
    }
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [open, refreshStatus])

  const saveSettings = useCallback(async () => {
    const base: SyncFilterConfig = {}
    if (fromDate) base.fromDate = fromDate
    if (toDate) base.toDate = toDate

    const filterConfig = buildFilterConfig
      ? buildFilterConfig(base)
      : (Object.keys(base).length > 0 ? base : {})

    const response = await updateSettingsApi(projectId, { syncFrequency, filterConfig })
    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to update settings')
    }
  }, [projectId, syncFrequency, fromDate, toDate, updateSettingsApi, buildFilterConfig])

  const handleUpdateSettings = useCallback(async () => {
    setIsUpdatingSettings(true)
    setError(null)
    try {
      await saveSettings()
      setSuccessMessage('Settings updated successfully.')
      await refreshStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings')
    } finally {
      setIsUpdatingSettings(false)
    }
  }, [saveSettings, refreshStatus])

  const handleStopSync = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    const synced = syncProgress?.current ?? 0
    setIsSyncing(false)
    setSuccessMessage(`Sync stopped. ${synced} ${synced === 1 ? itemNoun : itemNounPlural} synced.`)
    setShowResultLink(synced > 0)
    void refreshStatus()
    onStatusChanged?.()
  }, [syncProgress, itemNoun, itemNounPlural, refreshStatus, onStatusChanged])

  const handleSync = useCallback(async () => {
    setIsSyncing(true)
    setSyncProgress(null)
    setError(null)
    setShowResultLink(false)

    try {
      await saveSettings()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings before sync')
      setIsSyncing(false)
      return
    }

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const mode = hasSyncMode && status.lastSyncAt ? syncMode : 'full'
    const eventSource = new EventSource(syncUrl(projectId, mode))
    eventSourceRef.current = eventSource

    eventSource.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data)
        setSyncProgress(data)

        if (data.type === 'complete') {
          eventSource.close()
          eventSourceRef.current = null
          setIsSyncing(false)
          setSuccessMessage(data.message)
          setShowResultLink(true)
          void refreshStatus()
          onStatusChanged?.()
        } else if (data.type === 'error') {
          eventSource.close()
          eventSourceRef.current = null
          setIsSyncing(false)
          setError(data.message)
          void refreshStatus()
          onStatusChanged?.()
        }
      } catch {
        // Ignore parse errors
      }
    })

    eventSource.onerror = () => {
      eventSource.close()
      eventSourceRef.current = null
      setIsSyncing(false)
      setError('Connection to sync stream lost.')
      void refreshStatus()
      onStatusChanged?.()
    }
  }, [saveSettings, hasSyncMode, status.lastSyncAt, syncMode, syncUrl, projectId, refreshStatus, onStatusChanged])

  return {
    status,
    isLoading,
    error,
    setError,
    successMessage,
    setSuccessMessage,
    showResultLink,
    syncFrequency,
    setSyncFrequency,
    fromDate,
    setFromDate,
    toDate,
    setToDate,
    syncMode,
    setSyncMode,
    isSyncing,
    syncProgress,
    isUpdatingSettings,
    refreshStatus,
    handleUpdateSettings,
    handleSync,
    handleStopSync,
  }
}
