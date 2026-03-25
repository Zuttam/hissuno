'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Check, Unplug, Shield, KeyRound, Plug, Zap } from 'lucide-react'
import { Dialog, Button, InlineAlert, Spinner, FormField, Input, Select } from '@/components/ui'
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
import { useIntegrationSync } from '@/hooks/use-integration-sync'
import { SyncSettingsSection } from './sync-settings-section'
import { formatSyncDate } from '@/lib/integrations/shared/sync-constants'

interface HubSpotConfigDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onStatusChanged?: () => void
  oauthAvailable?: boolean
  oauthUnavailableReason?: string
}

type OverwritePolicy = 'fill_nulls' | 'hubspot_wins' | 'never_overwrite'

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
  const [overwritePolicy, setOverwritePolicy] = useState<OverwritePolicy>('fill_nulls')

  const onStatusLoaded = useCallback((data: Record<string, unknown>) => {
    const filterConfig = data.filterConfig as { overwritePolicy?: OverwritePolicy } | null | undefined
    if (filterConfig?.overwritePolicy) {
      setOverwritePolicy(filterConfig.overwritePolicy)
    }
  }, [])

  const buildFilterConfig = useCallback((base: Record<string, unknown>) => {
    return { ...base, overwritePolicy }
  }, [overwritePolicy])

  const sync = useIntegrationSync({
    projectId,
    open,
    fetchStatus: fetchHubSpotStatus,
    updateSettings: updateHubSpotSettings,
    syncUrl: hubspotSyncUrl,
    itemNoun: 'record',
    itemNounPlural: 'records',
    onStatusChanged,
    buildFilterConfig,
    onStatusLoaded,
  })

  // Connection method toggle
  const [connectionMethod, setConnectionMethod] = useState<'oauth' | 'token'>(oauthAvailable === false ? 'token' : 'oauth')

  // Connect form state
  const [accessToken, setAccessToken] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)

  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

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
      sync.setError('Access token is required.')
      return
    }

    setIsConnecting(true)
    sync.setError(null)

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
      sync.setSuccessMessage(null)
      onStatusChanged?.()
      await sync.refreshStatus()
    } catch (err) {
      sync.setError(err instanceof Error ? err.message : 'Failed to connect HubSpot')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    sync.setError(null)

    try {
      const response = await disconnectHubSpot(projectId)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to disconnect HubSpot')
      }

      await sync.refreshStatus()
      onStatusChanged?.()
    } catch (err) {
      sync.setError(err instanceof Error ? err.message : 'Failed to disconnect HubSpot')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const status = sync.status as { connected?: boolean; hubName?: string; hubId?: string; authMethod?: string; lastSyncAt?: string; lastSyncStatus?: string; lastSyncCompaniesCount?: number; lastSyncContactsCount?: number; nextSyncAt?: string; stats?: { totalCompanies: number; totalContacts: number } }

  return (
    <Dialog open={open} onClose={onClose} title="HubSpot Integration" size="lg">
      <div className="flex flex-col gap-6">
        {sync.error && <InlineAlert variant="danger">{sync.error}</InlineAlert>}

        {sync.successMessage && (
          <InlineAlert variant="success">{sync.successMessage}</InlineAlert>
        )}

        {sync.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : status.connected ? (
          // Connected state
          <div className="flex flex-col gap-6">
            <p className="flex items-center gap-2 text-sm text-[color:var(--accent-success)]"><Check size={14} />Connected to {status.hubName || status.hubId || 'HubSpot'}{status.authMethod && <span className="ml-2 inline-flex items-center rounded-full bg-[color:var(--background-subtle)] px-2 py-0.5 text-xs font-medium text-[color:var(--text-secondary)]">{status.authMethod === 'oauth' ? 'OAuth' : 'Private App Token'}</span>}</p>

            {/* Sync Stats */}
            <div className="flex flex-col gap-2">
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
                  <span className="font-medium">{formatSyncDate(status.lastSyncAt)}</span>
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

            <SyncSettingsSection
              syncFrequency={sync.syncFrequency}
              onSyncFrequencyChange={sync.setSyncFrequency}
              fromDate={sync.fromDate}
              onFromDateChange={sync.setFromDate}
              toDate={sync.toDate}
              onToDateChange={sync.setToDate}
              syncMode={sync.syncMode}
              onSyncModeChange={sync.setSyncMode}
              isSyncing={sync.isSyncing}
              syncProgress={sync.syncProgress}
              isUpdatingSettings={sync.isUpdatingSettings}
              lastSyncAt={status.lastSyncAt}
              nextSyncAt={status.nextSyncAt}
              onSave={sync.handleUpdateSettings}
              onSync={sync.handleSync}
              onStopSync={sync.handleStopSync}
              itemNounPlural="records"
              integrationId="hubspot"
              extraSettings={
                <FormField
                  label="Data Merge Policy"
                  supportingText={OVERWRITE_OPTIONS.find((o) => o.value === overwritePolicy)?.description}
                >
                  <Select
                    value={overwritePolicy}
                    onChange={(e) => setOverwritePolicy(e.target.value as OverwritePolicy)}
                  >
                    {OVERWRITE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </Select>
                </FormField>
              }
            />

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
          <div className="flex flex-col gap-6">
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
              <div className="flex flex-col gap-4">
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
              <div className="flex flex-col gap-4">
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
                <FormField label="Access Token">
                  <Input
                    type="password"
                    value={accessToken}
                    onChange={(e) => {
                      setAccessToken(e.target.value)
                      setTestResult(null)
                    }}
                    placeholder="pat-na1-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
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
                </FormField>

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
