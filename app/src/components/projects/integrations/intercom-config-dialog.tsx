'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Unplug, Shield, KeyRound, Plug, Zap } from 'lucide-react'
import { Dialog, Button, InlineAlert, Spinner, FormField, Input } from '@/components/ui'
import { ToggleGroup } from '@/components/ui/toggle-group'
import {
  fetchIntercomStatus,
  disconnectIntercom,
  updateIntercomSettings,
  testIntercomConnection,
  connectIntercom,
  intercomOAuthConnectUrl,
  intercomSyncUrl,
} from '@/lib/api/integrations'
import { useIntegrationSync } from '@/hooks/use-integration-sync'
import { SyncSettingsSection } from './sync-settings-section'
import { formatSyncDate } from '@/lib/integrations/shared/sync-constants'

interface IntercomConfigDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onStatusChanged?: () => void
  /** Whether OAuth env vars are configured on this instance */
  oauthAvailable?: boolean
  /** Human-readable reason when OAuth is unavailable */
  oauthUnavailableReason?: string
}

export function IntercomConfigDialog({
  open,
  onClose,
  projectId,
  onStatusChanged,
  oauthAvailable,
  oauthUnavailableReason,
}: IntercomConfigDialogProps) {
  const sync = useIntegrationSync({
    projectId,
    open,
    fetchStatus: fetchIntercomStatus,
    updateSettings: updateIntercomSettings,
    syncUrl: intercomSyncUrl,
    itemNoun: 'conversation',
    itemNounPlural: 'conversations',
    onStatusChanged,
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
      const response = await testIntercomConnection(accessToken.trim())
      const data = await response.json()

      if (response.ok) {
        setTestResult({ success: true, message: `Connected to: ${data.workspaceName}` })
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
      const response = await connectIntercom({
        projectId,
        accessToken: accessToken.trim(),
        syncFrequency: sync.syncFrequency,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect Intercom')
      }

      setAccessToken('')
      sync.setSuccessMessage(null)
      onStatusChanged?.()
      await sync.refreshStatus()
    } catch (err) {
      sync.setError(err instanceof Error ? err.message : 'Failed to connect Intercom')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    sync.setError(null)

    try {
      const response = await disconnectIntercom(projectId)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to disconnect Intercom')
      }

      await sync.refreshStatus()
      onStatusChanged?.()
    } catch (err) {
      sync.setError(err instanceof Error ? err.message : 'Failed to disconnect Intercom')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const status = sync.status as { connected?: boolean; workspaceName?: string; lastSyncAt?: string; lastSyncStatus?: string; lastSyncConversationsCount?: number; nextSyncAt?: string; stats?: { totalSynced: number } }

  return (
    <Dialog open={open} onClose={onClose} title="Intercom Integration" size="lg">
      <div className="flex flex-col gap-6">
        {sync.error && <InlineAlert variant="danger">{sync.error}</InlineAlert>}

        {sync.successMessage && (
          <InlineAlert variant="success">
            {sync.successMessage}
            {sync.showResultLink && (
              <>
                {' '}
                <Link
                  href={`/projects/${projectId}/sessions?source=intercom`}
                  className="font-medium underline hover:text-[color:var(--foreground)]"
                  onClick={onClose}
                >
                  View synced feedbacks
                </Link>
              </>
            )}
          </InlineAlert>
        )}

        {sync.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : status.connected ? (
          // Connected state
          <div className="flex flex-col gap-6">
            <p className="flex items-center gap-2 text-sm text-[color:var(--accent-success)]"><Check size={14} />Connected to {status.workspaceName || 'Unknown'}</p>

            {/* Sync Stats */}
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-medium text-[color:var(--foreground)]">Sync Status</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[color:var(--text-secondary)]">Total Synced:</span>{' '}
                  <Link
                    href={`/projects/${projectId}/sessions?source=intercom`}
                    className="font-medium text-[color:var(--accent-selected)] hover:underline"
                    onClick={onClose}
                  >
                    {status.stats?.totalSynced || 0} conversations
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
                <div>
                  <span className="text-[color:var(--text-secondary)]">Last Synced:</span>{' '}
                  <span className="font-medium">
                    {status.lastSyncConversationsCount || 0} conversations
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
              itemNounPlural="conversations"
              integrationId="intercom"
            />

            {/* Danger Zone */}
            <div className="border-t border-[color:var(--accent-danger)] pt-4">
              <p className="font-mono text-xs font-medium uppercase tracking-wide text-[color:var(--text-secondary)]">Danger Zone</p>
              <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                This will remove the Intercom connection. Previously synced sessions will remain.
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
              Connect your Intercom workspace to sync conversations into Hissuno.
            </InlineAlert>

            {/* Connection Method Toggle */}
            <ToggleGroup
              value={connectionMethod}
              onChange={setConnectionMethod}
              options={[
                { value: 'oauth' as const, label: 'OAuth', icon: <Shield size={14} /> },
                { value: 'token' as const, label: 'Access Token', icon: <KeyRound size={14} /> },
              ]}
            />

            {connectionMethod === 'oauth' ? (
              <div className="flex flex-col gap-4">
                {oauthAvailable === false ? (
                  <InlineAlert variant="attention">
                    OAuth is not configured on this instance. {oauthUnavailableReason} Use the Access Token method instead.
                  </InlineAlert>
                ) : (
                  <>
                    <p className="text-sm text-[color:var(--text-secondary)]">
                      Connect with one click using your Intercom account. You&apos;ll be redirected to Intercom to authorize access.
                    </p>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        window.location.href = intercomOAuthConnectUrl(projectId)
                      }}
                    >
                      <Plug size={14} />
                      Connect with Intercom
                    </Button>
                  </>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-[color:var(--text-tertiary)]">
                  For developers with private Intercom apps. You&apos;ll need an{' '}
                  <a
                    href="https://developers.intercom.com/docs/build-an-integration/getting-started/create-an-app"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-[color:var(--foreground)]"
                  >
                    Intercom access token
                  </a>{' '}
                  with read permissions.
                </p>

                {/* Access Token */}
                <FormField
                  label="Access Token"
                  supportingText="Find this in your Intercom Developer Hub under your app's Authentication settings."
                >
                  <Input
                    type="password"
                    value={accessToken}
                    onChange={(e) => {
                      setAccessToken(e.target.value)
                      setTestResult(null)
                    }}
                    placeholder="Enter your Intercom access token"
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
                    Connect Intercom
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
