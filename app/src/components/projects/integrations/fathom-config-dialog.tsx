'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Unplug, Plug, Zap } from 'lucide-react'
import { Dialog, Button, InlineAlert, Spinner, FormField, Input } from '@/components/ui'
import {
  fetchFathomStatus,
  testFathomConnection,
  connectFathom,
  disconnectFathom,
  updateFathomSettings,
  fathomSyncUrl,
} from '@/lib/api/integrations'
import { useIntegrationSync } from '@/hooks/use-integration-sync'
import { SyncSettingsSection } from './sync-settings-section'
import { formatSyncDate } from '@/lib/integrations/shared/sync-constants'

interface FathomConfigDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onStatusChanged?: () => void
}

export function FathomConfigDialog({
  open,
  onClose,
  projectId,
  onStatusChanged,
}: FathomConfigDialogProps) {
  const sync = useIntegrationSync({
    projectId,
    open,
    fetchStatus: fetchFathomStatus,
    updateSettings: updateFathomSettings,
    syncUrl: fathomSyncUrl,
    itemNoun: 'meeting',
    itemNounPlural: 'meetings',
    onStatusChanged,
  })

  const [apiKey, setApiKey] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isTesting, setIsTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      setTestResult({ success: false, message: 'Enter your API key first.' })
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      const response = await testFathomConnection(apiKey.trim())
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
    if (!apiKey.trim()) {
      sync.setError('API key is required.')
      return
    }

    setIsConnecting(true)
    sync.setError(null)

    try {
      const response = await connectFathom({ projectId, apiKey: apiKey.trim() })
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to connect Fathom')
      }

      setApiKey('')
      sync.setSuccessMessage('Connected to Fathom successfully!')
      onStatusChanged?.()
      await sync.refreshStatus()
    } catch (err) {
      sync.setError(err instanceof Error ? err.message : 'Failed to connect Fathom')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    sync.setError(null)

    try {
      const response = await disconnectFathom(projectId)
      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to disconnect Fathom')
      }

      await sync.refreshStatus()
      onStatusChanged?.()
    } catch (err) {
      sync.setError(err instanceof Error ? err.message : 'Failed to disconnect Fathom')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const status = sync.status as { connected?: boolean; lastSyncAt?: string; lastSyncStatus?: string; lastSyncMeetingsCount?: number; nextSyncAt?: string; stats?: { totalSynced: number } }

  return (
    <Dialog open={open} onClose={onClose} title="Fathom Integration" size="lg">
      <div className="flex flex-col gap-6">
        {sync.error && <InlineAlert variant="danger">{sync.error}</InlineAlert>}

        {sync.successMessage && (
          <InlineAlert variant="success">
            {sync.successMessage}
            {sync.showResultLink && (
              <>
                {' '}
                <Link
                  href={`/projects/${projectId}/sessions?source=fathom`}
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
            <p className="flex items-center gap-2 text-sm text-[color:var(--accent-success)]">
              <Check size={14} />
              Connected to Fathom
            </p>

            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-medium text-[color:var(--foreground)]">Sync Status</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-[color:var(--text-secondary)]">Total Synced:</span>{' '}
                  <Link
                    href={`/projects/${projectId}/sessions?source=fathom`}
                    className="font-medium text-[color:var(--accent-selected)] hover:underline"
                    onClick={onClose}
                  >
                    {status.stats?.totalSynced || 0} meetings
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
                    {status.lastSyncMeetingsCount || 0} meetings
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
              itemNounPlural="meetings"
              integrationId="fathom"
            />

            <div className="border-t border-[color:var(--accent-danger)] pt-4">
              <p className="font-mono text-xs font-medium uppercase tracking-wide text-[color:var(--text-secondary)]">Danger Zone</p>
              <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">
                This will remove the Fathom connection. Previously synced sessions will remain.
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
              Connect your Fathom account to sync AI meeting notes and transcripts into Hissuno.
              You&apos;ll need a{' '}
              <a
                href="https://fathom.video/settings/api"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[color:var(--foreground)]"
              >
                Fathom API key
              </a>.
            </InlineAlert>

            <div className="flex flex-col gap-4">
              <FormField label="API Key" supportingText="Find this in your Fathom account under Settings > API.">
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => {
                    setApiKey(e.target.value)
                    setTestResult(null)
                  }}
                  placeholder="Enter your Fathom API key"
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
                  Connect Fathom
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Dialog>
  )
}
