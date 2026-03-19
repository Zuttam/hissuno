'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Dialog, Button, Alert, Spinner } from '@/components/ui'
import {
  fetchGongStatus,
  testGongConnection,
  connectGong,
  disconnectGong,
  updateGongSettings,
  gongSyncUrl,
} from '@/lib/api/integrations'

interface GongConfigDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onStatusChanged?: () => void
}

type SyncFrequency = 'manual' | '1h' | '6h' | '24h'
type SyncMode = 'incremental' | 'full'

interface FilterConfig {
  fromDate?: string
  toDate?: string
}

interface GongStatus {
  connected: boolean
  syncFrequency?: SyncFrequency | null
  syncEnabled?: boolean
  lastSyncAt?: string | null
  lastSyncStatus?: 'success' | 'error' | 'in_progress' | null
  lastSyncCallsCount?: number
  nextSyncAt?: string | null
  filterConfig?: FilterConfig | null
  stats?: {
    totalSynced: number
    lastSyncRuns: Array<{
      status: string
      startedAt: string
      callsSynced: number
    }>
  }
}

interface SyncProgress {
  type: string
  message: string
  current: number
  total: number
  callId?: string
  sessionId?: string
}

const FREQUENCY_OPTIONS: Array<{ value: SyncFrequency; label: string }> = [
  { value: 'manual', label: 'Manual only' },
  { value: '1h', label: 'Every hour' },
  { value: '6h', label: 'Every 6 hours' },
  { value: '24h', label: 'Daily' },
]

export function GongConfigDialog({
  open,
  onClose,
  projectId,
  onStatusChanged,
}: GongConfigDialogProps) {
  const [status, setStatus] = useState<GongStatus>({ connected: false })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showSessionsLink, setShowSessionsLink] = useState(false)

  // Connect form state
  const [baseUrl, setBaseUrl] = useState('')
  const [accessKey, setAccessKey] = useState('')
  const [accessKeySecret, setAccessKeySecret] = useState('')
  const [syncFrequency, setSyncFrequency] = useState<SyncFrequency>('manual')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  // Test connection state
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  // Connected state
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const [syncMode, setSyncMode] = useState<SyncMode>('incremental')

  const eventSourceRef = useRef<EventSource | null>(null)

  // Fetch status
  const fetchStatus = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetchGongStatus(projectId)
      if (!response.ok) {
        throw new Error('Failed to load Gong status')
      }
      const data = await response.json()
      setStatus(data)

      // Initialize form state from existing config
      if (data.filterConfig) {
        setFromDate(data.filterConfig.fromDate || '')
        setToDate(data.filterConfig.toDate || '')
      }
      if (data.syncFrequency) {
        setSyncFrequency(data.syncFrequency)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load Gong status')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (open) {
      void fetchStatus()
    }
    return () => {
      // Cleanup event source on close
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [open, fetchStatus])

  const handleTestConnection = async () => {
    if (!baseUrl.trim() || !accessKey.trim() || !accessKeySecret.trim()) {
      setTestResult({ success: false, message: 'Enter base URL, access key, and secret first.' })
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      const response = await testGongConnection({
        baseUrl: baseUrl.trim(),
        accessKey: accessKey.trim(),
        accessKeySecret: accessKeySecret.trim(),
      })
      const data = await response.json()

      if (response.ok) {
        setTestResult({ success: true, message: 'Connection successful!' })
      } else {
        setTestResult({ success: false, message: data.error || 'Connection failed' })
      }
    } catch {
      setTestResult({ success: false, message: 'Failed to test connection' })
    } finally {
      setIsTesting(false)
    }
  }

  const handleConnect = async () => {
    if (!baseUrl.trim() || !accessKey.trim() || !accessKeySecret.trim()) {
      setError('Base URL, access key, and secret are required.')
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      const filterConfig: FilterConfig = {}
      if (fromDate) filterConfig.fromDate = fromDate
      if (toDate) filterConfig.toDate = toDate

      const response = await connectGong({
        projectId,
        baseUrl: baseUrl.trim(),
        accessKey: accessKey.trim(),
        accessKeySecret: accessKeySecret.trim(),
        syncFrequency,
        filterConfig: Object.keys(filterConfig).length > 0 ? filterConfig : undefined,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect Gong')
      }

      setBaseUrl('')
      setAccessKey('')
      setAccessKeySecret('')
      setSuccessMessage('Connected to Gong successfully!')
      onStatusChanged?.()
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect Gong')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    setError(null)

    try {
      const response = await disconnectGong(projectId)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to disconnect Gong')
      }

      setStatus({ connected: false })
      onStatusChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect Gong')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const saveSettings = async (): Promise<{ success: boolean }> => {
    const filterConfig: FilterConfig = {}
    if (fromDate) filterConfig.fromDate = fromDate
    if (toDate) filterConfig.toDate = toDate

    const response = await updateGongSettings(projectId, {
      syncFrequency,
      filterConfig: Object.keys(filterConfig).length > 0 ? filterConfig : {},
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error || 'Failed to update settings')
    }

    return { success: true }
  }

  const handleUpdateSettings = async () => {
    setIsUpdatingSettings(true)
    setError(null)

    try {
      await saveSettings()
      setSuccessMessage('Settings updated successfully.')
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings')
    } finally {
      setIsUpdatingSettings(false)
    }
  }

  const handleStopSync = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    const synced = syncProgress?.current ?? 0
    setIsSyncing(false)
    setSuccessMessage(`Sync stopped. ${synced} call${synced === 1 ? '' : 's'} synced.`)
    setShowSessionsLink(synced > 0)
    void fetchStatus()
    onStatusChanged?.()
  }

  const handleSync = async () => {
    setIsSyncing(true)
    setSyncProgress(null)
    setError(null)
    setShowSessionsLink(false)

    // Auto-save settings so the sync uses the current UI state
    try {
      await saveSettings()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings before sync')
      setIsSyncing(false)
      return
    }

    // Close any existing event source
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const mode = status.lastSyncAt ? syncMode : 'full'
    const eventSource = new EventSource(gongSyncUrl(projectId, mode))
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
          setShowSessionsLink(true)
          void fetchStatus()
          onStatusChanged?.()
        } else if (data.type === 'error') {
          eventSource.close()
          eventSourceRef.current = null
          setIsSyncing(false)
          setError(data.message)
          void fetchStatus()
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
      void fetchStatus()
      onStatusChanged?.()
    }
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleString()
  }

  return (
    <Dialog open={open} onClose={onClose} title="Gong Integration" size="xxl">
      <div className="flex flex-col gap-6">
        {error && <Alert variant="danger">{error}</Alert>}

        {successMessage && (
          <Alert variant="success">
            {successMessage}
            {showSessionsLink && (
              <>
                {' '}
                <Link
                  href={`/projects/${projectId}/sessions?source=gong`}
                  className="font-medium underline hover:text-[color:var(--foreground)]"
                  onClick={onClose}
                >
                  View synced feedbacks
                </Link>
              </>
            )}
          </Alert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : status.connected ? (
          // Connected state
          <div className="space-y-6">
            <Alert variant="success">
              &#10003; Connected to Gong
            </Alert>

            {/* Sync Stats */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-[color:var(--foreground)]">Sync Status</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[color:var(--text-secondary)]">Total Synced:</span>{' '}
                  <Link
                    href={`/projects/${projectId}/sessions?source=gong`}
                    className="font-medium text-[color:var(--accent-selected)] hover:underline"
                    onClick={onClose}
                  >
                    {status.stats?.totalSynced || 0} calls
                  </Link>
                </div>
                <div>
                  <span className="text-[color:var(--text-secondary)]">Last Sync:</span>{' '}
                  <span className="font-medium">{formatDate(status.lastSyncAt)}</span>
                </div>
                <div>
                  <span className="text-[color:var(--text-secondary)]">Last Status:</span>{' '}
                  <span
                    className={`font-medium ${
                      status.lastSyncStatus === 'success'
                        ? 'text-[color:var(--accent-success)]'
                        : status.lastSyncStatus === 'error'
                          ? 'text-[color:var(--accent-danger)]'
                          : status.lastSyncStatus === 'in_progress'
                            ? 'text-[color:var(--accent-warning)]'
                            : ''
                    }`}
                  >
                    {status.lastSyncStatus || 'Never synced'}
                  </span>
                </div>
                <div>
                  <span className="text-[color:var(--text-secondary)]">Last Synced:</span>{' '}
                  <span className="font-medium">
                    {status.lastSyncCallsCount || 0} calls
                  </span>
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="space-y-4 border-t border-[color:var(--border-subtle)] pt-4">
              <h4 className="text-sm font-medium text-[color:var(--foreground)]">Sync Settings</h4>

              {/* Sync Frequency */}
              <div className="space-y-1">
                <label className="text-sm text-[color:var(--text-secondary)]">Sync Frequency</label>
                <select
                  value={syncFrequency}
                  onChange={(e) => setSyncFrequency(e.target.value as SyncFrequency)}
                  className="w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
                >
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-sm text-[color:var(--text-secondary)]">From Date (optional)</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-[color:var(--text-secondary)]">To Date (optional)</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
                  />
                </div>
              </div>

              <Button
                variant="secondary"
                onClick={handleUpdateSettings}
                loading={isUpdatingSettings}
              >
                Save Settings
              </Button>
            </div>

            {/* Manual Sync */}
            <div className="space-y-3 border-t border-[color:var(--border-subtle)] pt-4">
              <h4 className="text-sm font-medium text-[color:var(--foreground)]">Manual Sync</h4>

              {status.lastSyncAt && !isSyncing && (
                <div className="space-y-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gong-sync-mode"
                      value="incremental"
                      checked={syncMode === 'incremental'}
                      onChange={() => setSyncMode('incremental')}
                      className="mt-1"
                    />
                    <div>
                      <span className="text-sm text-[color:var(--foreground)]">Sync new only</span>
                      <p className="text-xs text-[color:var(--text-tertiary)]">
                        Only import calls since {formatDate(status.lastSyncAt)}
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="gong-sync-mode"
                      value="full"
                      checked={syncMode === 'full'}
                      onChange={() => setSyncMode('full')}
                      className="mt-1"
                    />
                    <div>
                      <span className="text-sm text-[color:var(--foreground)]">Sync from start date</span>
                      <p className="text-xs text-[color:var(--text-tertiary)]">
                        Re-scan all calls from your configured date range. Already imported sessions will be skipped.
                      </p>
                    </div>
                  </label>
                </div>
              )}

              {isSyncing && syncProgress && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Spinner size="sm" />
                    <span className="text-sm text-[color:var(--text-secondary)]">
                      {syncProgress.message}
                    </span>
                  </div>
                  {syncProgress.total > 0 && (
                    <div className="h-2 w-full rounded-full bg-[color:var(--border-subtle)] overflow-hidden">
                      <div
                        className="h-full bg-[color:var(--accent-selected)] transition-all duration-300"
                        style={{
                          width: `${Math.round((syncProgress.current / syncProgress.total) * 100)}%`,
                        }}
                      />
                    </div>
                  )}
                </div>
              )}

              {isSyncing ? (
                <Button variant="danger" onClick={handleStopSync}>
                  Stop Sync
                </Button>
              ) : (
                <Button variant="secondary" onClick={handleSync}>
                  Sync Now
                </Button>
              )}

              <p className="text-xs text-[color:var(--text-tertiary)]">
                Manually trigger a sync to import call transcripts from Gong.
                {status.nextSyncAt && (
                  <>
                    {' '}
                    Next automatic sync: {formatDate(status.nextSyncAt)}
                  </>
                )}
              </p>
            </div>

            {/* Danger Zone */}
            <div className="space-y-2 pt-2 border-t border-[color:var(--border-subtle)]">
              <h4 className="text-xs font-medium text-[color:var(--accent-danger)]">Danger Zone</h4>
              <Button variant="danger" onClick={handleDisconnect} loading={isDisconnecting}>
                Disconnect
              </Button>
              <p className="text-xs text-[color:var(--text-tertiary)]">
                This will remove the Gong connection. Previously synced sessions will remain.
              </p>
            </div>
          </div>
        ) : (
          // Not connected state
          <div className="space-y-6">
            <Alert variant="info">
              Connect your Gong account to sync call transcripts into Hissuno.
              You&apos;ll need a{' '}
              <a
                href="https://app.gong.io/company/api"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[color:var(--foreground)]"
              >
                Gong API key
              </a>{' '}
              (access key + secret).
            </Alert>

            {/* Connect Form */}
            <div className="space-y-4">
              {/* Base URL */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-[color:var(--foreground)]">
                  API Base URL
                </label>
                <input
                  type="text"
                  value={baseUrl}
                  onChange={(e) => {
                    setBaseUrl(e.target.value)
                    setTestResult(null)
                  }}
                  placeholder="e.g. https://us-60267.api.gong.io"
                  className="w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
                />
                <p className="text-xs text-[color:var(--text-tertiary)]">
                  Find this in your Gong account under Settings &gt; API. It looks like https://xx-xxxxx.api.gong.io
                </p>
              </div>

              {/* Access Key */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-[color:var(--foreground)]">
                  Access Key
                </label>
                <input
                  type="text"
                  value={accessKey}
                  onChange={(e) => {
                    setAccessKey(e.target.value)
                    setTestResult(null)
                  }}
                  placeholder="Enter your Gong access key"
                  className="w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
                />
              </div>

              {/* Access Key Secret */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-[color:var(--foreground)]">
                  Access Key Secret
                </label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    value={accessKeySecret}
                    onChange={(e) => {
                      setAccessKeySecret(e.target.value)
                      setTestResult(null)
                    }}
                    placeholder="Enter your Gong access key secret"
                    className="flex-1 rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
                  />
                  <Button
                    variant="secondary"
                    onClick={handleTestConnection}
                    loading={isTesting}
                    disabled={isTesting}
                  >
                    Test
                  </Button>
                </div>
                {testResult && (
                  <p
                    className={`text-xs ${
                      testResult.success
                        ? 'text-[color:var(--accent-success)]'
                        : 'text-[color:var(--accent-danger)]'
                    }`}
                  >
                    {testResult.message}
                  </p>
                )}
                <p className="text-xs text-[color:var(--text-tertiary)]">
                  Find this in your Gong account under Settings &gt; API.
                </p>
              </div>

              {/* Sync Frequency */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-[color:var(--foreground)]">
                  Sync Frequency
                </label>
                <select
                  value={syncFrequency}
                  onChange={(e) => setSyncFrequency(e.target.value as SyncFrequency)}
                  className="w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
                >
                  {FREQUENCY_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range (optional) */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-[color:var(--foreground)]">
                  Date Range (optional)
                </label>
                <p className="text-xs text-[color:var(--text-tertiary)]">
                  Only sync calls within this date range. Leave empty to sync all.
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs text-[color:var(--text-secondary)]">From</label>
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs text-[color:var(--text-secondary)]">To</label>
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
                    />
                  </div>
                </div>
              </div>

              <Button variant="primary" onClick={handleConnect} loading={isConnecting}>
                Connect Gong
              </Button>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-[color:var(--border-subtle)] pt-4">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
