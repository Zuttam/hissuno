'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Check, Unplug, Plug } from 'lucide-react'
import { Dialog, Button, InlineAlert, Spinner, FormField, Input } from '@/components/ui'
import {
  fetchPosthogStatus,
  connectPosthog,
  disconnectPosthog,
  updatePosthogSettings,
  posthogSyncUrl,
} from '@/lib/api/integrations'
import { useIntegrationSync } from '@/hooks/use-integration-sync'
import { SyncSettingsSection } from './sync-settings-section'
import { formatSyncDate } from '@/lib/integrations/shared/sync-constants'

interface PosthogConfigDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onStatusChanged?: () => void
}

export function PosthogConfigDialog({
  open,
  onClose,
  projectId,
  onStatusChanged,
}: PosthogConfigDialogProps) {
  const [syncNewContacts, setSyncNewContacts] = useState(false)

  const onStatusLoaded = useCallback((data: Record<string, unknown>) => {
    const filterConfig = data.filterConfig as { sync_new_contacts?: boolean } | null | undefined
    if (filterConfig?.sync_new_contacts !== undefined) {
      setSyncNewContacts(filterConfig.sync_new_contacts)
    }
  }, [])

  const buildFilterConfig = useCallback((base: Record<string, unknown>) => {
    return { ...base, sync_new_contacts: syncNewContacts }
  }, [syncNewContacts])

  const sync = useIntegrationSync({
    projectId,
    open,
    fetchStatus: fetchPosthogStatus,
    updateSettings: updatePosthogSettings,
    syncUrl: (pid) => posthogSyncUrl(pid),
    itemNoun: 'profile',
    itemNounPlural: 'profiles',
    hasSyncMode: false,
    onStatusChanged,
    buildFilterConfig,
    onStatusLoaded,
  })

  // Connect form state
  const [apiKey, setApiKey] = useState('')
  const [host, setHost] = useState('https://app.posthog.com')
  const [posthogProjectId, setPosthogProjectId] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [isDisconnecting, setIsDisconnecting] = useState(false)

  const handleConnect = async () => {
    if (!apiKey.trim() || !posthogProjectId.trim()) {
      sync.setError('API Key and PostHog Project ID are required.')
      return
    }

    setIsConnecting(true)
    sync.setError(null)

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
      sync.setSuccessMessage('Connected to PostHog successfully!')
      onStatusChanged?.()
      await sync.refreshStatus()
    } catch (err) {
      sync.setError(err instanceof Error ? err.message : 'Failed to connect PostHog')
    } finally {
      setIsConnecting(false)
    }
  }

  const handleDisconnect = async () => {
    setIsDisconnecting(true)
    sync.setError(null)

    try {
      const response = await disconnectPosthog(projectId)

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to disconnect PostHog')
      }

      await sync.refreshStatus()
      onStatusChanged?.()
    } catch (err) {
      sync.setError(err instanceof Error ? err.message : 'Failed to disconnect PostHog')
    } finally {
      setIsDisconnecting(false)
    }
  }

  const status = sync.status as { connected?: boolean; host?: string; posthogProjectId?: string; lastSyncAt?: string; lastSyncStatus?: string; lastSyncProfilesCount?: number; nextSyncAt?: string; stats?: { totalSynced: number; lastSyncRuns: Array<{ contactsCreated: number }> } }

  return (
    <Dialog open={open} onClose={onClose} title="PostHog Integration" size="lg">
      <div className="flex flex-col gap-6">
        {sync.error && <InlineAlert variant="danger">{sync.error}</InlineAlert>}

        {sync.successMessage && (
          <InlineAlert variant="success">
            {sync.successMessage}
            {sync.showResultLink && (
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

        {sync.isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : status.connected ? (
          // Connected state
          <div className="flex flex-col gap-6">
            <p className="flex items-center gap-2 text-sm text-[color:var(--accent-success)]"><Check size={14} />Connected to PostHog</p>

            {/* Connection Info */}
            <div className="flex flex-col gap-2">
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
            <div className="flex flex-col gap-2">
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
              itemNounPlural="profiles"
              integrationId="posthog"
              hasSyncMode={false}
              extraSettings={
                <div className="flex flex-col gap-1">
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
              }
            />

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
          <div className="flex flex-col gap-6">
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
            <div className="flex flex-col gap-4">
              {/* API Key */}
              <FormField label="API Key" supportingText="Create a Personal API Key in PostHog under Settings > Personal API Keys.">
                <Input
                  type="password"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="phx_..."
                />
              </FormField>

              {/* Host URL */}
              <FormField label="PostHog Host URL" supportingText="Use https://app.posthog.com for PostHog Cloud US, https://eu.posthog.com for EU, or your self-hosted URL.">
                <Input
                  type="text"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="https://app.posthog.com"
                />
              </FormField>

              {/* PostHog Project ID */}
              <FormField label="PostHog Project ID" supportingText="The numeric project ID from PostHog. Find it in your project settings URL.">
                <Input
                  type="text"
                  value={posthogProjectId}
                  onChange={(e) => setPosthogProjectId(e.target.value)}
                  placeholder="e.g. 12345"
                />
              </FormField>

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
