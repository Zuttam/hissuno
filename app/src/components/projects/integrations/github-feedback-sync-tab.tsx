'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Save, RefreshCw } from 'lucide-react'
import { Button, InlineAlert, Spinner } from '@/components/ui'
import {
  fetchGithubSyncConfig,
  saveGithubSyncConfig,
  githubSyncFeedbackUrl,
} from '@/lib/api/integrations'
import { SESSION_TAGS, SESSION_TAG_INFO } from '@/types/session'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GitHubFeedbackSyncTabProps {
  projectId: string
  selectedRepos: Array<{ id: number; fullName: string }>
}

type TabState = 'loading' | 'not_configured' | 'configuring' | 'configured'
type SyncFrequency = 'manual' | '1h' | '6h' | '24h'

interface SyncConfig {
  syncType: string
  githubRepoIds?: Array<{ id: number; fullName: string }>
  githubLabelFilter?: string | null
  githubLabelTagMap?: Record<string, string> | null
  syncEnabled?: boolean
  syncFrequency?: string
  lastSyncAt?: string | null
  lastSyncStatus?: string | null
  lastSyncError?: string | null
  lastSyncCount?: number | null
  nextSyncAt?: string | null
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

const selectClass =
  'w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function GitHubFeedbackSyncTab({ projectId, selectedRepos }: GitHubFeedbackSyncTabProps) {
  const [tabState, setTabState] = useState<TabState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Label filter & tag map
  const [labelFilter, setLabelFilter] = useState('')
  const [labelTagMap, setLabelTagMap] = useState<Record<string, string>>({})
  const [newLabelName, setNewLabelName] = useState('')

  // Configured state
  const [syncConfig, setSyncConfig] = useState<SyncConfig | null>(null)
  const [syncFrequency, setSyncFrequency] = useState<SyncFrequency>('manual')
  const [isSaving, setIsSaving] = useState(false)
  const [isUpdatingFrequency, setIsUpdatingFrequency] = useState(false)

  // Sync progress
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<SyncProgress | null>(null)
  const eventSourceRef = useRef<EventSource | null>(null)

  // ---------------------------------------------------------------------------
  // Load existing config on mount
  // ---------------------------------------------------------------------------

  const loadConfig = useCallback(async () => {
    setError(null)
    try {
      const response = await fetchGithubSyncConfig(projectId, 'feedback')
      if (response.ok) {
        const data = await response.json()
        if (data.configured && data.githubRepoIds?.length > 0) {
          setSyncConfig(data)
          setSyncFrequency((data.syncFrequency as SyncFrequency) || 'manual')
          setTabState('configured')
          return
        }
      }
      setTabState('not_configured')
    } catch {
      setTabState('not_configured')
    }
  }, [projectId])

  useEffect(() => {
    void loadConfig()
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close()
        eventSourceRef.current = null
      }
    }
  }, [loadConfig])

  // ---------------------------------------------------------------------------
  // Label tag map helpers
  // ---------------------------------------------------------------------------

  const addLabelMapping = () => {
    if (!newLabelName.trim()) return
    setLabelTagMap((prev) => ({ ...prev, [newLabelName.trim()]: 'bug' }))
    setNewLabelName('')
  }

  const updateLabelMapping = (label: string, tag: string) => {
    setLabelTagMap((prev) => ({ ...prev, [label]: tag }))
  }

  const removeLabelMapping = (label: string) => {
    setLabelTagMap((prev) => {
      const next = { ...prev }
      delete next[label]
      return next
    })
  }

  // ---------------------------------------------------------------------------
  // Save configuration
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    if (selectedRepos.length === 0) {
      setError('Please select at least one repository from the list above.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const response = await saveGithubSyncConfig({
        projectId,
        syncType: 'feedback',
        githubRepoIds: selectedRepos,
        githubLabelFilter: labelFilter || undefined,
        githubLabelTagMap: Object.keys(labelTagMap).length > 0 ? labelTagMap : undefined,
        syncFrequency,
        syncEnabled: true,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save configuration')
      }

      setSuccessMessage('Feedback sync configured successfully.')
      await loadConfig()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save configuration')
    } finally {
      setIsSaving(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Update sync frequency
  // ---------------------------------------------------------------------------

  const handleFrequencyChange = async (freq: SyncFrequency) => {
    setSyncFrequency(freq)
    if (!syncConfig) return

    setIsUpdatingFrequency(true)
    setError(null)

    try {
      const response = await saveGithubSyncConfig({
        projectId,
        syncType: 'feedback',
        githubRepoIds: syncConfig.githubRepoIds,
        githubLabelFilter: syncConfig.githubLabelFilter ?? undefined,
        githubLabelTagMap: syncConfig.githubLabelTagMap ?? undefined,
        syncFrequency: freq,
        syncEnabled: true,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update frequency')
      }

      setSuccessMessage('Sync frequency updated.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update frequency')
    } finally {
      setIsUpdatingFrequency(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Sync now
  // ---------------------------------------------------------------------------

  const handleSync = () => {
    setIsSyncing(true)
    setSyncProgress(null)
    setError(null)
    setSuccessMessage(null)

    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const es = new EventSource(githubSyncFeedbackUrl(projectId))
    eventSourceRef.current = es

    es.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data)
        setSyncProgress(data)

        if (data.type === 'complete') {
          es.close()
          eventSourceRef.current = null
          setIsSyncing(false)
          setSuccessMessage(data.message || 'Sync completed.')
          void loadConfig()
        } else if (data.type === 'error') {
          es.close()
          eventSourceRef.current = null
          setIsSyncing(false)
          setError(data.message || 'Sync failed.')
          void loadConfig()
        }
      } catch {
        // ignore parse errors
      }
    })

    es.onerror = () => {
      es.close()
      eventSourceRef.current = null
      setIsSyncing(false)
      setError('Connection to sync stream lost.')
      void loadConfig()
    }
  }

  const handleStopSync = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    setIsSyncing(false)
    setSuccessMessage('Sync stopped.')
    void loadConfig()
  }

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return 'Never'
    return new Date(dateStr).toLocaleString()
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (tabState === 'loading') {
    return (
      <div className="flex items-center justify-center py-8">
        <Spinner size="md" />
      </div>
    )
  }

  // ---- Configured state ----
  if (tabState === 'configured' && syncConfig) {
    const repoList = syncConfig.githubRepoIds ?? []
    const tagMap = syncConfig.githubLabelTagMap ?? {}
    return (
      <div className="flex flex-col gap-6">
        {error && <InlineAlert variant="danger">{error}</InlineAlert>}
        {successMessage && <InlineAlert variant="success">{successMessage}</InlineAlert>}

        {/* Config summary */}
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-[color:var(--foreground)]">Configuration</h4>
          <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3 flex flex-col gap-1">
            <p className="text-sm text-[color:var(--text-secondary)]">
              <span className="text-[color:var(--text-tertiary)]">Repositories:</span>{' '}
              <span className="font-medium">{repoList.map((r) => r.fullName).join(', ')}</span>
            </p>
            {syncConfig.githubLabelFilter && (
              <p className="text-sm text-[color:var(--text-secondary)]">
                <span className="text-[color:var(--text-tertiary)]">Label filter:</span>{' '}
                <span className="font-medium">{syncConfig.githubLabelFilter}</span>
              </p>
            )}
            {Object.keys(tagMap).length > 0 && (
              <p className="text-sm text-[color:var(--text-secondary)]">
                <span className="text-[color:var(--text-tertiary)]">Label mappings:</span>{' '}
                <span className="font-medium">
                  {Object.entries(tagMap).map(([label, tag]) => `${label} -> ${tag}`).join(', ')}
                </span>
              </p>
            )}
          </div>
        </div>

        {/* Sync frequency */}
        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium text-[color:var(--foreground)]">Sync Frequency</label>
          <select
            value={syncFrequency}
            onChange={(e) => void handleFrequencyChange(e.target.value as SyncFrequency)}
            disabled={isUpdatingFrequency}
            className={selectClass}
          >
            {FREQUENCY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Last sync info */}
        <div className="flex flex-col gap-2">
          <h4 className="text-sm font-medium text-[color:var(--foreground)]">Sync Status</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-[color:var(--text-secondary)]">Last Sync:</span>{' '}
              <span className="font-medium">{formatDate(syncConfig.lastSyncAt)}</span>
            </div>
            <div>
              <span className="text-[color:var(--text-secondary)]">Status:</span>{' '}
              <span
                className={`font-medium ${
                  syncConfig.lastSyncStatus === 'completed'
                    ? 'text-[color:var(--accent-success)]'
                    : syncConfig.lastSyncStatus === 'error'
                      ? 'text-[color:var(--accent-danger)]'
                      : ''
                }`}
              >
                {syncConfig.lastSyncStatus || 'Never synced'}
              </span>
            </div>
            {syncConfig.lastSyncCount != null && (
              <div>
                <span className="text-[color:var(--text-secondary)]">Issues synced:</span>{' '}
                <span className="font-medium">{syncConfig.lastSyncCount}</span>
              </div>
            )}
          </div>
        </div>

        {isSyncing && syncProgress && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Spinner size="sm" />
              <span className="text-sm text-[color:var(--text-secondary)]">{syncProgress.message}</span>
            </div>
            {syncProgress.total > 0 && (
              <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--border-subtle)]">
                <div
                  className="h-full bg-[color:var(--accent-selected)] transition-all duration-300"
                  style={{ width: `${Math.round((syncProgress.current / syncProgress.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {isSyncing ? (
            <Button variant="danger" size="sm" onClick={handleStopSync}>
              Stop Sync
            </Button>
          ) : (
            <>
              <Button variant="primary" size="sm" onClick={handleSync}>
                <RefreshCw size={14} />
                Sync
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  setLabelFilter(syncConfig.githubLabelFilter ?? '')
                  setLabelTagMap(syncConfig.githubLabelTagMap ?? {})
                  setTabState('configuring')
                  setSuccessMessage(null)
                }}
              >
                Reconfigure
              </Button>
            </>
          )}
        </div>
        {syncConfig.nextSyncAt && (
          <p className="text-xs text-[color:var(--text-tertiary)]">
            Next automatic sync: {formatDate(syncConfig.nextSyncAt)}
          </p>
        )}
      </div>
    )
  }

  // ---- Not configured / Configuring state ----
  if (selectedRepos.length === 0) {
    return (
      <div className="flex flex-col gap-4">
        {error && <InlineAlert variant="danger">{error}</InlineAlert>}
        <InlineAlert variant="info">
          Select repositories above to configure feedback sync.
        </InlineAlert>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <InlineAlert variant="danger">{error}</InlineAlert>}
      {successMessage && <InlineAlert variant="success">{successMessage}</InlineAlert>}

      {/* Label filter */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-[color:var(--foreground)]">Label Filter</label>
        <input
          type="text"
          value={labelFilter}
          onChange={(e) => setLabelFilter(e.target.value)}
          placeholder="e.g. feedback"
          className={selectClass}
        />
        <p className="text-xs text-[color:var(--text-tertiary)]">
          Only sync issues with this GitHub label. Leave empty to sync all issues.
        </p>
      </div>

      {/* Label to tag mapping */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-[color:var(--foreground)]">Label to Tag Mapping</label>
        <p className="text-xs text-[color:var(--text-tertiary)]">
          Map GitHub labels to session tags for automatic classification.
        </p>

        {Object.entries(labelTagMap).length > 0 && (
          <div className="flex flex-col gap-1 border-l-2 border-[color:var(--border-subtle)] pl-4">
            {Object.entries(labelTagMap).map(([label, tag]) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-32 truncate text-sm text-[color:var(--text-secondary)]">{label}</span>
                <span className="text-xs text-[color:var(--text-tertiary)]">-&gt;</span>
                <select
                  value={tag}
                  onChange={(e) => updateLabelMapping(label, e.target.value)}
                  className="flex-1 rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
                >
                  {SESSION_TAGS.map((t) => (
                    <option key={t} value={t}>
                      {SESSION_TAG_INFO[t].label}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removeLabelMapping(label)}
                  className="text-xs text-[color:var(--accent-danger)] hover:underline"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newLabelName}
            onChange={(e) => setNewLabelName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addLabelMapping() }}
            placeholder="GitHub label name"
            className="flex-1 rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
          />
          <Button variant="secondary" size="sm" onClick={addLabelMapping} disabled={!newLabelName.trim()}>
            Add
          </Button>
        </div>
      </div>

      {/* Sync Frequency */}
      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium text-[color:var(--foreground)]">Sync Frequency</label>
        <select
          value={syncFrequency}
          onChange={(e) => setSyncFrequency(e.target.value as SyncFrequency)}
          className={selectClass}
        >
          {FREQUENCY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <p className="text-xs text-[color:var(--text-tertiary)]">How often to automatically sync issues from GitHub.</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSave}
          loading={isSaving}
        >
          <Save size={14} />
          Save
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => { void handleSave().then(() => handleSync()) }}
          disabled={isSaving || isSyncing}
        >
          <RefreshCw size={14} />
          Save & Sync
        </Button>
      </div>
    </div>
  )
}
