'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Check, Unplug, Plug } from 'lucide-react'
import { Dialog, Button, InlineAlert, Spinner } from '@/components/ui'
import {
  fetchPosthogStatus,
  connectPosthog,
  disconnectPosthog,
  updatePosthogSettings,
  posthogSyncUrl,
} from '@/lib/api/integrations'

interface PosthogConfigDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onStatusChanged?: () => void
}

type SyncFrequency = 'manual' | '1h' | '6h' | '24h'

interface PosthogStatus {
  connected: boolean
  host?: string | null
  posthogProjectId?: string | null
  syncFrequency?: SyncFrequency | null
  syncEnabled?: boolean
  lastSyncAt?: string | null
  lastSyncStatus?: 'success' | 'error' | 'in_progress' | null
  lastSyncProfilesCount?: number
  nextSyncAt?: string | null
  filterConfig?: {
    sync_new_contacts?: boolean
    max_new_contacts?: number
    fromDate?: string
    toDate?: string
  } | null
  stats?: {
    totalSynced: number
    lastSyncRuns: Array<{
      status: string
      startedAt: string
      profilesSynced: number
      contactsCreated: number
    }>
  }
}

interface SyncProgress {
  type: string
  message: string
  current: number
  total: number
  contactId?: string
  email?: string
}

const FREQUENCY_OPTIONS: Array<{ value: SyncFrequency; label: string }> = [
  { value: 'manual', label: 'Manual only' },
  { value: '1h', label: 'Every hour' },
  { value: '6h', label: 'Every 6 hours' },
  { value: '24h', label: 'Daily' },
]

export function PosthogConfigDialog({
  open,
  onClose,
  projectId,
  onStatusChanged,
}: PosthogConfigDialogProps) {
  const [status, setStatus] = useState<PosthogStatus>({ connected: false })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [showContactsLink, setShowContactsLink] = useState(false)

  // Connect form state
  const [apiKey, setApiKey] = useState('')
  const [host, setHost] = useState('https://app.posthog.com')
  const [posthogProjectId, setPosthogProjectId] = useState('')
  const [syncFrequency, setSyncFrequency] = useState<SyncFrequency>('manual')
  const [syncNewContacts, setSyncNewContacts] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  // Connected state
  const [isDisconnecting, setIsDisconnecting] = useState(false)
  const [isUpdatingSettings, setIsUpdatingSettings] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)

  const eventSourceRef = useRef<EventSource | null>(null)

  // Fetch status
  const fetchStatus = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetchPosthogStatus(projectId)
      if (!response.ok) {
        throw new Error('Failed to load PostHog status')
      }
      const data = await response.json()
      setStatus(data)

      if (data.syncFrequency) {
        setSyncFrequency(data.syncFrequency)
      }
      if (data.filterConfig?.sync_new_contacts !== undefined) {
        setSyncNewContacts(data.filterConfig.sync_new_contacts)
      }
      setFromDate(data.filterConfig?.fromDate || '')
      setToDate(data.filterConfig?.toDate || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PostHog status')
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

  const handleConnect = async () => {
    if (!apiKey.trim() || !posthogProjectId.trim()) {
      setError('API Key and PostHog Project ID are required.')
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      const response = await connectPosthog({
        projectId,
        apiKey: apiKey.trim(),
        host: host.trim() || 'https://app.posthog.com',
        posthogProjectId: posthogProjectId.trim(),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect PostHog')
      }

      setApiKey('')
      setHost('https://app.posthog.com')
      setPosthogProjectId('')
      setSuccessMessage('Connected to PostHog successfully!')
      onStatusChanged?.()
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect PostHog')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    setError(null)

    try {
      const response = await disconnectPosthog(projectId)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to disconnect PostHog')
      }

      setStatus({ connected: false })
      onStatusChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect PostHog')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const saveSettings = async (): Promise<{ success: boolean }> => {
    const filterConfig: Record<string, unknown> = { sync_new_contacts: syncNewContacts }
    if (fromDate) filterConfig.fromDate = fromDate
    if (toDate) filterConfig.toDate = toDate

    const response = await updatePosthogSettings(projectId, {
      syncFrequency,
      filterConfig,
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
    setSuccessMessage(`Sync stopped. ${synced} profile${synced === 1 ? '' : 's'} synced.`)
    setShowContactsLink(synced > 0)
    void fetchStatus()
    onStatusChanged?.()
  }

  const handleSync = async () => {
    setIsSyncing(true)
    setSyncProgress(null)
    setError(null)
    setShowContactsLink(false)

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

    const eventSource = new EventSource(posthogSyncUrl(projectId))
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
          setShowContactsLink(true)
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
    <Dialog open={open} onClose={onClose} title="PostHog Integration" size="lg">
      <div className="flex flex-col gap-6">
        {error && <InlineAlert variant="danger">{error}</InlineAlert>}

        {successMessage && (
          <InlineAlert variant="success">
            {successMessage}
            {showContactsLink && (
              <>
                {' '}
                <Link
                  href={`/projects/${projectId}/contacts`}
                  className="font-medium underline hover:text-[color:var(--foreground)]"
                  onClick={onClose}
                >
                  View synced contacts
                </Link>
              </>
            )}
          </InlineAlert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : status.connected ? (
          // Connected state
          <div className="space-y-6">
            <p className="flex items-center gap-2 text-sm text-[color:var(--accent-success)]"><Check size={14} />Connected to PostHog</p>

            {/* Connection Info */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-[color:var(--foreground)]">Connection</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[color:var(--text-secondary)]">Host:</span>{' '}
                  <span className="font-medium">{status.host || 'https://app.posthog.com'}</span>
                </div>
                <div>
                  <span className="text-[color:var(--text-secondary)]">Project ID:</span>{' '}
                  <span className="font-medium">{status.posthogProjectId || '-'}</span>
                </div>
              </div>
            </div>

            {/* Sync Stats */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-[color:var(--foreground)]">Sync Status</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[color:var(--text-secondary)]">Total Synced:</span>{' '}
                  <Link
                    href={`/projects/${projectId}/contacts`}
                    className="font-medium text-[color:var(--accent-selected)] hover:underline"
                    onClick={onClose}
                  >
                    {status.stats?.totalSynced || 0} profiles
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
                    {status.lastSyncProfilesCount || 0} profiles
                  </span>
                </div>
                {(status.stats?.lastSyncRuns?.[0]?.contactsCreated ?? 0) > 0 && (
                  <div>
                    <span className="text-[color:var(--text-secondary)]">Contacts Created:</span>{' '}
                    <span className="font-medium">
                      {status.stats?.lastSyncRuns?.[0]?.contactsCreated ?? 0}
                    </span>
                  </div>
                )}
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
              <div className="space-y-2">
                <label className="text-sm text-[color:var(--text-secondary)]">
                  Date Range (optional)
                </label>
                <p className="text-xs text-[color:var(--text-tertiary)]">
                  Only sync events within this date range. Leave empty to use the default (last 30 days).
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

              {/* Create New Contacts Toggle */}
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={syncNewContacts}
                    onChange={(e) => setSyncNewContacts(e.target.checked)}
                    className="rounded border-[color:var(--border)] text-[color:var(--accent-selected)] focus:ring-[color:var(--accent-selected)]"
                  />
                  <span className="text-[color:var(--foreground)]">Create new contacts from PostHog</span>
                </label>
                <p className="text-xs text-[color:var(--text-tertiary)] pl-6">
                  When enabled, PostHog persons without a matching contact will be created as new contacts
                  with behavioral profiles and activity sessions.
                </p>
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
                Manually trigger a sync to import user profiles and events from PostHog.
                {status.nextSyncAt && (
                  <>
                    {' '}
                    Next automatic sync: {formatDate(status.nextSyncAt)}
                  </>
                )}
              </p>
            </div>

            {/* Danger Zone */}
            <div className="border-t border-[color:var(--accent-danger)] pt-4">
              <p className="font-mono text-xs font-medium uppercase tracking-wide text-[color:var(--text-secondary)]">Danger Zone</p>
              <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                This will remove the PostHog connection. Previously synced contacts will remain.
              </p>
              <Button
                variant="danger"
                size="sm"
                className="mt-3"
                onClick={handleDisconnect}
                disabled={isDisconnecting}
                loading={isDisconnecting}
              >
                <Unplug size={14} />
                Disconnect
              </Button>
            </div>
          </div>
        ) : (
          // Not connected state
          <div className="space-y-6">
            <InlineAlert variant="info">
              Connect your PostHog account to sync user profiles and event data into Hissuno.
              You&apos;ll need a{' '}
              <a
                href="https://posthog.com/docs/api"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[color:var(--foreground)]"
              >
                PostHog Personal API Key
              </a>
              .
            </InlineAlert>

            {/* Connect Form */}
            <div className="space-y-4">
              {/* API Key */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-[color:var(--foreground)]">
                  API Key
                </label>
                <input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="phx_..."
                  className="w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
                />
                <p className="text-xs text-[color:var(--text-tertiary)]">
                  Create a Personal API Key in PostHog under Settings &gt; Personal API Keys.
                </p>
              </div>

              {/* Host URL */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-[color:var(--foreground)]">
                  PostHog Host URL
                </label>
                <input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="https://app.posthog.com"
                  className="w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
                />
                <p className="text-xs text-[color:var(--text-tertiary)]">
                  Use https://app.posthog.com for PostHog Cloud US, https://eu.posthog.com for EU, or your self-hosted URL.
                </p>
              </div>

              {/* PostHog Project ID */}
              <div className="space-y-1">
                <label className="text-sm font-medium text-[color:var(--foreground)]">
                  PostHog Project ID
                </label>
                <input
                  type="text"
                  value={posthogProjectId}
                  onChange={(e) => setPosthogProjectId(e.target.value)}
                  placeholder="e.g. 12345"
                  className="w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
                />
                <p className="text-xs text-[color:var(--text-tertiary)]">
                  The numeric project ID from PostHog. Find it in your project settings URL.
                </p>
              </div>

              <Button variant="primary" size="sm" onClick={handleConnect} loading={isConnecting}>
                <Plug size={14} />
                Test & Connect
              </Button>
            </div>
          </div>
        )}

      </div>
    </Dialog>
  )
}
