'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Unplug, Plug, Zap } from 'lucide-react'
import { Dialog, Button, InlineAlert, Spinner, FormField, Input } from '@/components/ui'
import {
  fetchZendeskStatus,
  testZendeskConnection,
  connectZendesk,
  disconnectZendesk,
  updateZendeskSettings,
  zendeskSyncUrl,
} from '@/lib/api/integrations'
import { useIntegrationSync } from '@/hooks/use-integration-sync'
import { SyncSettingsSection } from './sync-settings-section'
import { formatSyncDate } from '@/lib/integrations/shared/sync-constants'

interface ZendeskConfigDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onStatusChanged?: () => void
}

export function ZendeskConfigDialog({
  open,
  onClose,
  projectId,
  onStatusChanged,
}: ZendeskConfigDialogProps) {
  const sync = useIntegrationSync({
    projectId,
    open,
    fetchStatus: fetchZendeskStatus,
    updateSettings: updateZendeskSettings,
    syncUrl: zendeskSyncUrl,
    itemNoun: 'ticket',
    itemNounPlural: 'tickets',
    onStatusChanged,
  })

  const [subdomain, setSubdomain] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [apiToken, setApiToken] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const handleTestConnection = async () => {
    if (!subdomain.trim() || !adminEmail.trim() || !apiToken.trim()) {
      setTestResult({ success: false, message: 'All fields are required.' })
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      const response = await testZendeskConnection({
        subdomain: subdomain.trim(),
        email: adminEmail.trim(),
        apiToken: apiToken.trim(),
      })
      const data = await response.json()

      if (response.ok) {
        setTestResult({ success: true, message: `Connected as: ${data.accountName}` })
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
    if (!subdomain.trim() || !adminEmail.trim() || !apiToken.trim()) {
      sync.setError('All credential fields are required.')
      return
    }

    setIsConnecting(true)
    sync.setError(null)

    try {
      const response = await connectZendesk({
        projectId,
        subdomain: subdomain.trim(),
        email: adminEmail.trim(),
        apiToken: apiToken.trim(),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect Zendesk')
      }

      setSubdomain('')
      setAdminEmail('')
      setApiToken('')
      sync.setSuccessMessage(null)
      onStatusChanged?.()
      await sync.refreshStatus()
    } catch (err) {
      sync.setError(err instanceof Error ? err.message : 'Failed to connect Zendesk')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    sync.setError(null)

    try {
      const response = await disconnectZendesk(projectId)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to disconnect Zendesk')
      }

      await sync.refreshStatus()
      onStatusChanged?.()
    } catch (err) {
      sync.setError(err instanceof Error ? err.message : 'Failed to disconnect Zendesk')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const status = sync.status as { connected?: boolean; subdomain?: string; accountName?: string; lastSyncAt?: string; lastSyncStatus?: string; lastSyncTicketsCount?: number; nextSyncAt?: string; stats?: { totalSynced: number } }

  return (
    <Dialog open={open} onClose={onClose} title="Zendesk Integration" size="lg">
      <div className="flex flex-col gap-6">
        {sync.error && <InlineAlert variant="danger">{sync.error}</InlineAlert>}

        {sync.successMessage && (
          <InlineAlert variant="success">
            {sync.successMessage}
            {sync.showResultLink && (
              <>
                {' '}
                <Link
                  href={`/projects/${projectId}/sessions?source=zendesk`}
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
          <div className="flex flex-col gap-6">
            <p className="flex items-center gap-2 text-sm text-[color:var(--accent-success)]"><Check size={14} />Connected to {status.accountName || status.subdomain || 'Zendesk'}{status.subdomain && <span className="text-[color:var(--text-secondary)]"> ({status.subdomain}.zendesk.com)</span>}</p>

            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-medium text-[color:var(--foreground)]">Sync Status</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[color:var(--text-secondary)]">Total Synced:</span>{' '}
                  <Link
                    href={`/projects/${projectId}/sessions?source=zendesk`}
                    className="font-medium text-[color:var(--accent-selected)] hover:underline"
                    onClick={onClose}
                  >
                    {status.stats?.totalSynced || 0} tickets
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
                    {status.lastSyncTicketsCount || 0} tickets
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
              itemNounPlural="tickets"
              integrationId="zendesk"
            />

            <div className="border-t border-[color:var(--accent-danger)] pt-4">
              <p className="font-mono text-xs font-medium uppercase tracking-wide text-[color:var(--text-secondary)]">Danger Zone</p>
              <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                This will remove the Zendesk connection. Previously synced sessions will remain.
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
          <div className="flex flex-col gap-6">
            <InlineAlert variant="info">
              Connect your Zendesk account to sync solved/closed tickets into Hissuno.
            </InlineAlert>

            <div className="flex flex-col gap-4">
              <p className="text-xs text-[color:var(--text-tertiary)]">
                You&apos;ll need your Zendesk subdomain, admin email, and an{' '}
                <a
                  href="https://developer.zendesk.com/api-reference/introduction/security-and-auth/#api-token"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-[color:var(--foreground)]"
                >
                  API token
                </a>
                .
              </p>

              <FormField label="Subdomain">
                <div className="flex items-center gap-0">
                  <Input
                    type="text"
                    value={subdomain}
                    onChange={(e) => {
                      setSubdomain(e.target.value)
                      setTestResult(null)
                    }}
                    placeholder="mycompany"
                    className="rounded-r-none border-r-0"
                  />
                  <span className="rounded-r-[4px] border border-[color:var(--border)] bg-[color:var(--surface-secondary)] px-3 py-2 text-sm text-[color:var(--text-secondary)]">
                    .zendesk.com
                  </span>
                </div>
              </FormField>

              <FormField label="Admin Email">
                <Input
                  type="email"
                  value={adminEmail}
                  onChange={(e) => {
                    setAdminEmail(e.target.value)
                    setTestResult(null)
                  }}
                  placeholder="admin@company.com"
                />
              </FormField>

              <FormField label="API Token" supportingText="Generate an API token in Zendesk Admin > Apps and integrations > Zendesk API.">
                <Input
                  type="password"
                  value={apiToken}
                  onChange={(e) => {
                    setApiToken(e.target.value)
                    setTestResult(null)
                  }}
                  placeholder="Enter your Zendesk API token"
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
                  Connect Zendesk
                </Button>
              </div>
            </div>
          </div>
        )}

      </div>
    </Dialog>
  )
}
