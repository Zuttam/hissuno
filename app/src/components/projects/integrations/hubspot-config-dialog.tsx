'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Link from 'next/link'
import { Check, Unplug, Shield, KeyRound, Plug, Zap } from 'lucide-react'
import { Dialog, Button, InlineAlert, Spinner } from '@/components/ui'
import { ToggleGroup } from '@/components/ui/toggle-group'
import {
  fetchHubSpotStatus,
  disconnectHubSpot,
  updateHubSpotSettings,
  testHubSpotConnection,
  connectHubSpot,
  hubspotOAuthConnectUrl,
  hubspotSyncUrl,
} from '@/lib/api/integrations'

interface HubSpotConfigDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onStatusChanged?: () => void
  oauthAvailable?: boolean
  oauthUnavailableReason?: string
}

type SyncFrequency = 'manual' | '1h' | '6h' | '24h'
type SyncMode = 'incremental' | 'full'
type OverwritePolicy = 'fill_nulls' | 'hubspot_wins' | 'never_overwrite'

interface FilterConfig {
  fromDate?: string
  toDate?: string
  overwritePolicy?: OverwritePolicy
}

interface HubSpotStatus {
  connected: boolean
  hubName?: string | null
  hubId?: string | null
  authMethod?: 'oauth' | 'token' | null
  syncFrequency?: SyncFrequency | null
  syncEnabled?: boolean
  lastSyncAt?: string | null
  lastSyncStatus?: 'success' | 'error' | 'in_progress' | null
  lastSyncCompaniesCount?: number
  lastSyncContactsCount?: number
  nextSyncAt?: string | null
  filterConfig?: FilterConfig | null
  stats?: {
    totalCompanies: number
    totalContacts: number
    lastSyncRuns: Array<{
      status: string
      startedAt: string
      companiesSynced: number
      contactsSynced: number
    }>
  }
}

interface SyncProgress {
  type: string
  message: string
  current: number
  total: number
}

const FREQUENCY_OPTIONS: Array<{ value: SyncFrequency; label: string }> = [
  { value: 'manual', label: 'Manual only' },
  { value: '1h', label: 'Every hour' },
  { value: '6h', label: 'Every 6 hours' },
  { value: '24h', label: 'Daily' },
]

const OVERWRITE_OPTIONS: Array<{ value: OverwritePolicy; label: string; description: string }> = [
  { value: 'fill_nulls', label: 'Fill empty fields only', description: 'Only populate fields that are currently empty in Hissuno' },
  { value: 'hubspot_wins', label: 'HubSpot wins', description: 'Overwrite Hissuno fields with HubSpot data on every sync' },
  { value: 'never_overwrite', label: 'Never overwrite', description: 'Only create new records, never update existing ones' },
]

export function HubSpotConfigDialog({
  open,
  onClose,
  projectId,
  onStatusChanged,
  oauthAvailable,
  oauthUnavailableReason,
}: HubSpotConfigDialogProps) {
  const [status, setStatus] = useState<HubSpotStatus>({ connected: false })
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Connection method toggle
  const [connectionMethod, setConnectionMethod] = useState<'oauth' | 'token'>(oauthAvailable === false ? 'token' : 'oauth')

  // Connect form state
  const [accessToken, setAccessToken] = useState('')
  const [syncFrequency, setSyncFrequency] = useState<SyncFrequency>('manual')
  const [overwritePolicy, setOverwritePolicy] = useState<OverwritePolicy>('fill_nulls')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
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
      const response = await fetchHubSpotStatus(projectId)
      if (!response.ok) {
        throw new Error('Failed to load HubSpot status')
      }
      const data = await response.json()
      setStatus(data)

      if (data.filterConfig) {
        setFromDate(data.filterConfig.fromDate || '')
        setToDate(data.filterConfig.toDate || '')
        setOverwritePolicy(data.filterConfig.overwritePolicy || 'fill_nulls')
      }
      if (data.syncFrequency) {
        setSyncFrequency(data.syncFrequency)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load HubSpot status')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (open) {
      void fetchStatus()
    }
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [open, fetchStatus])

  const handleTestConnection = async () => {
    if (!accessToken.trim()) {
      setTestResult({ success: false, message: 'Enter an access token first.' })
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      const response = await testHubSpotConnection(accessToken.trim())
      const data = await response.json()

      if (response.ok) {
        setTestResult({ success: true, message: `Connected to: ${data.hubName || data.hubId}` })
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
    if (!accessToken.trim()) {
      setError('Access token is required.')
      return
    }

    setIsConnecting(true)
    setError(null)

    try {
      const response = await connectHubSpot({
        projectId,
        accessToken: accessToken.trim(),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect HubSpot')
      }

      setAccessToken('')
      setSuccessMessage(null)
      onStatusChanged?.()
      await fetchStatus()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect HubSpot')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    setError(null)

    try {
      const response = await disconnectHubSpot(projectId)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to disconnect HubSpot')
      }

      setStatus({ connected: false })
      onStatusChanged?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disconnect HubSpot')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const saveSettings = async (): Promise<{ success: boolean }> => {
    const filterConfig: FilterConfig = { overwritePolicy }
    if (fromDate) filterConfig.fromDate = fromDate
    if (toDate) filterConfig.toDate = toDate

    const response = await updateHubSpotSettings(projectId, {
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
    setIsSyncing(false)
    setSuccessMessage('Sync stopped.')
    void fetchStatus()
    onStatusChanged?.()
  }

  const handleSync = async () => {
    setIsSyncing(true)
    setSyncProgress(null)
    setError(null)

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

    const mode = status.lastSyncAt ? syncMode : 'full'
    const eventSource = new EventSource(
      hubspotSyncUrl(projectId, mode)
    )
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
    <Dialog open={open} onClose={onClose} title="HubSpot Integration" size="lg">
      <div className="flex flex-col gap-6">
        {error && <InlineAlert variant="danger">{error}</InlineAlert>}

        {successMessage && (
          <InlineAlert variant="success">{successMessage}</InlineAlert>
        )}

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : status.connected ? (
          // Connected state
          <div className="space-y-6">
            <p className="flex items-center gap-2 text-sm text-[color:var(--accent-success)]"><Check size={14} />Connected to {status.hubName || status.hubId || 'HubSpot'}{status.authMethod && <span className="ml-2 inline-flex items-center rounded-full bg-[color:var(--background-subtle)] px-2 py-0.5 text-xs font-medium text-[color:var(--text-secondary)]">{status.authMethod === 'oauth' ? 'OAuth' : 'Private App Token'}</span>}</p>

            {/* Sync Stats */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-[color:var(--foreground)]">Sync Status</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[color:var(--text-secondary)]">Companies Synced:</span>{' '}
                  <Link
                    href={`/projects/${projectId}/companies`}
                    className="font-medium text-[color:var(--accent-selected)] hover:underline"
                    onClick={onClose}
                  >
                    {status.stats?.totalCompanies || 0}
                  </Link>
                </div>
                <div>
                  <span className="text-[color:var(--text-secondary)]">Contacts Synced:</span>{' '}
                  <Link
                    href={`/projects/${projectId}/contacts`}
                    className="font-medium text-[color:var(--accent-selected)] hover:underline"
                    onClick={onClose}
                  >
                    {status.stats?.totalContacts || 0}
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

              {/* Overwrite Policy */}
              <div className="space-y-1">
                <label className="text-sm text-[color:var(--text-secondary)]">Data Merge Policy</label>
                <select
                  value={overwritePolicy}
                  onChange={(e) => setOverwritePolicy(e.target.value as OverwritePolicy)}
                  className="w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
                >
                  {OVERWRITE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-[color:var(--text-tertiary)]">
                  {OVERWRITE_OPTIONS.find((o) => o.value === overwritePolicy)?.description}
                </p>
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
            <div className="flex flex-col gap-3 border-t border-[color:var(--border-subtle)] pt-4">
              <div>
                <h4 className="text-sm font-medium text-[color:var(--foreground)]">Manual Sync</h4>
                <p className="text-xs text-[color:var(--text-tertiary)]">
                  Manually trigger a sync to import companies and contacts from HubSpot.
                  {status.nextSyncAt && (
                    <>
                      {' '}
                      Next automatic sync: {formatDate(status.nextSyncAt)}
                    </>
                  )}
                </p>
              </div>

              {status.lastSyncAt && !isSyncing && (
                <div className="flex flex-col gap-2">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="hubspot-sync-mode"
                      value="incremental"
                      checked={syncMode === 'incremental'}
                      onChange={() => setSyncMode('incremental')}
                      className="mt-1"
                    />
                    <div>
                      <span className="text-sm text-[color:var(--foreground)]">Sync new/updated only</span>
                      <p className="text-xs text-[color:var(--text-tertiary)]">
                        Only import records modified since {formatDate(status.lastSyncAt)}
                      </p>
                    </div>
                  </label>
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="hubspot-sync-mode"
                      value="full"
                      checked={syncMode === 'full'}
                      onChange={() => setSyncMode('full')}
                      className="mt-1"
                    />
                    <div>
                      <span className="text-sm text-[color:var(--foreground)]">Full sync</span>
                      <p className="text-xs text-[color:var(--text-tertiary)]">
                        Re-scan all records from your configured date range. Existing records will be updated per merge policy.
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

              <div>
                {isSyncing ? (
                  <Button variant="danger" onClick={handleStopSync}>
                    Stop Sync
                  </Button>
                ) : (
                  <Button variant="secondary" onClick={handleSync}>
                    Sync Now
                  </Button>
                )}
              </div>
            </div>

            {/* Danger Zone */}
            <div className="border-t border-[color:var(--accent-danger)] pt-4">
              <p className="font-mono text-xs font-medium uppercase tracking-wide text-[color:var(--text-secondary)]">Danger Zone</p>
              <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                This will remove the HubSpot connection. Previously synced companies and contacts will remain.
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
              Connect your HubSpot CRM to sync companies and contacts into Hissuno.
            </InlineAlert>

            {/* Connection Method Toggle */}
            <ToggleGroup
              value={connectionMethod}
              onChange={setConnectionMethod}
              options={[
                { value: 'oauth' as const, label: 'OAuth', icon: <Shield size={14} /> },
                { value: 'token' as const, label: 'Private App Token', icon: <KeyRound size={14} /> },
              ]}
            />

            {connectionMethod === 'oauth' ? (
              <div className="space-y-4">
                {oauthAvailable === false ? (
                  <InlineAlert variant="attention">
                    OAuth is not configured on this instance. {oauthUnavailableReason} Use the Private App Token method instead.
                  </InlineAlert>
                ) : (
                  <>
                    <p className="text-sm text-[color:var(--text-secondary)]">
                      Connect with one click using your HubSpot account. You&apos;ll be redirected to HubSpot to authorize access.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        window.location.href = hubspotOAuthConnectUrl(projectId)
                      }}
                    >
                      <Plug size={14} />
                      Connect with HubSpot
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-[color:var(--text-tertiary)]">
                  Create a{' '}
                  <a
                    href="https://developers.hubspot.com/docs/api/private-apps"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-[color:var(--foreground)]"
                  >
                    HubSpot private app
                  </a>{' '}
                  with <code>crm.objects.contacts.read</code> and <code>crm.objects.companies.read</code> scopes.
                </p>

                {/* Access Token */}
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[color:var(--foreground)]">
                    Access Token
                  </label>
                  <input
                    type="password"
                    value={accessToken}
                    onChange={(e) => {
                      setAccessToken(e.target.value)
                      setTestResult(null)
                    }}
                    placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    className="w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
                  />
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
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleTestConnection}
                    loading={isTesting}
                    disabled={isTesting}
                  >
                    <Zap size={14} />
                    Test
                  </Button>
                  <Button variant="primary" size="sm" onClick={handleConnect} loading={isConnecting}>
                    <Plug size={14} />
                    Connect HubSpot
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </Dialog>
  )
}
