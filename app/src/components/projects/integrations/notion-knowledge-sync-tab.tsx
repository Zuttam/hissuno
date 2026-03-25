'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Search, Save, RefreshCw } from 'lucide-react'
import { Button, InlineAlert, Spinner } from '@/components/ui'
import {
  fetchNotionPages,
  fetchNotionSyncConfig,
  saveNotionSyncConfig,
  notionSyncKnowledgeUrl,
} from '@/lib/api/integrations'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotionKnowledgeSyncTabProps {
  projectId: string
}

type TabState = 'loading' | 'not_configured' | 'configuring' | 'configured'
type SyncFrequency = 'manual' | '1h' | '6h' | '24h'

interface NotionPage {
  id: string
  title: string
  icon?: string | null
}

interface SyncConfig {
  syncType: string
  notionRootPageIds?: string[]
  includeChildren?: boolean
  syncEnabled?: boolean
  syncFrequency?: string
  lastSyncAt?: string | null
  lastSyncStatus?: string | null
  lastSyncCount?: number | null
  nextSyncAt?: string | null
  pages?: Array<{ id: string; title: string; icon?: string | null }>
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

export function NotionKnowledgeSyncTab({ projectId }: NotionKnowledgeSyncTabProps) {
  const [tabState, setTabState] = useState<TabState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Page search
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<NotionPage[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Selected pages
  const [selectedPages, setSelectedPages] = useState<Array<{ id: string; title: string; icon: string | null }>>([])
  const [includeChildren, setIncludeChildren] = useState(true)

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
      const response = await fetchNotionSyncConfig(projectId, 'knowledge')
      if (response.ok) {
        const data = await response.json()
        if (data.notionRootPageIds && data.notionRootPageIds.length > 0) {
          setSyncConfig(data)
          setSyncFrequency((data.syncFrequency as SyncFrequency) || 'manual')
          if (data.pages) {
            setSelectedPages(data.pages.map((p: NotionPage) => ({ id: p.id, title: p.title, icon: p.icon || null })))
          }
          setIncludeChildren(data.includeChildren !== false)
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
  // Page search with debounce
  // ---------------------------------------------------------------------------

  const searchPages = useCallback(
    async (query: string) => {
      setIsSearching(true)
      setError(null)
      try {
        const response = await fetchNotionPages(projectId, { query: query || undefined })
        if (!response.ok) throw new Error('Failed to search pages')
        const data = await response.json()
        setSearchResults(data.pages || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to search pages')
      } finally {
        setIsSearching(false)
      }
    },
    [projectId]
  )

  useEffect(() => {
    if (tabState !== 'not_configured' && tabState !== 'configuring') return

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    searchTimeoutRef.current = setTimeout(() => {
      void searchPages(searchQuery)
    }, 300)

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [searchQuery, tabState, searchPages])

  // ---------------------------------------------------------------------------
  // Page selection
  // ---------------------------------------------------------------------------

  const togglePage = (page: NotionPage) => {
    setSelectedPages((prev) => {
      const exists = prev.some((p) => p.id === page.id)
      if (exists) {
        return prev.filter((p) => p.id !== page.id)
      }
      return [...prev, { id: page.id, title: page.title, icon: page.icon || null }]
    })
  }

  const isPageSelected = (pageId: string) => selectedPages.some((p) => p.id === pageId)

  // ---------------------------------------------------------------------------
  // Save configuration
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    if (selectedPages.length === 0) {
      setError('Please select at least one page.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const response = await saveNotionSyncConfig({
        projectId,
        syncType: 'knowledge',
        notionRootPageIds: selectedPages.map((p) => p.id),
        includeChildren,
        syncFrequency,
        syncEnabled: true,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save configuration')
      }

      setSuccessMessage('Knowledge sync configured successfully.')
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
      const response = await saveNotionSyncConfig({
        projectId,
        syncType: 'knowledge',
        notionRootPageIds: syncConfig.notionRootPageIds,
        includeChildren: syncConfig.includeChildren,
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

    const es = new EventSource(notionSyncKnowledgeUrl(projectId))
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
    return (
      <div className="space-y-6">
        {error && <InlineAlert variant="danger">{error}</InlineAlert>}
        {successMessage && <InlineAlert variant="success">{successMessage}</InlineAlert>}

        {/* Selected pages summary */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-[color:var(--foreground)]">Selected Pages</h4>
          <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3 space-y-1">
            {selectedPages.map((page) => (
              <p key={page.id} className="flex items-center gap-2 text-sm text-[color:var(--text-secondary)]">
                {page.icon && <span>{page.icon}</span>}
                <span className="font-medium">{page.title || 'Untitled'}</span>
              </p>
            ))}
            {syncConfig.includeChildren !== false && (
              <p className="text-xs text-[color:var(--text-tertiary)] mt-1">Including child pages</p>
            )}
          </div>
        </div>

        {/* Sync frequency */}
        <div className="space-y-1">
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
        <div className="space-y-2">
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
                  syncConfig.lastSyncStatus === 'success'
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
                <span className="text-[color:var(--text-secondary)]">Pages synced:</span>{' '}
                <span className="font-medium">{syncConfig.lastSyncCount}</span>
              </div>
            )}
          </div>
        </div>

        {isSyncing && syncProgress && (
          <div className="space-y-2">
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
                  setTabState('configuring')
                  setSuccessMessage(null)
                }}
              >
                Change Selection
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
  return (
    <div className="space-y-6">
      {error && <InlineAlert variant="danger">{error}</InlineAlert>}
      {successMessage && <InlineAlert variant="success">{successMessage}</InlineAlert>}

      <InlineAlert variant="info">
        Select Notion pages to sync as knowledge sources.
      </InlineAlert>

      {/* Page search */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[color:var(--foreground)]">Search Pages</label>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--text-tertiary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by page title..."
            className="w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] py-2 pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
          />
        </div>

        {/* Search results */}
        <div className="max-h-48 overflow-y-auto rounded-[4px] border border-[color:var(--border-subtle)]">
          {isSearching ? (
            <div className="flex items-center justify-center py-4">
              <Spinner size="sm" />
            </div>
          ) : searchResults.length === 0 ? (
            <p className="px-3 py-4 text-center text-sm text-[color:var(--text-tertiary)]">
              {searchQuery ? 'No pages found.' : 'Start typing to search pages.'}
            </p>
          ) : (
            searchResults.map((page) => (
              <label
                key={page.id}
                className="flex cursor-pointer items-center gap-3 border-b border-[color:var(--border-subtle)] px-3 py-2 last:border-b-0 hover:bg-[color:var(--surface-hover)]"
              >
                <input
                  type="checkbox"
                  checked={isPageSelected(page.id)}
                  onChange={() => togglePage(page)}
                  className="rounded"
                />
                {page.icon && <span className="text-sm">{page.icon}</span>}
                <span className="truncate text-sm text-[color:var(--foreground)]">{page.title || 'Untitled'}</span>
              </label>
            ))
          )}
        </div>
      </div>

      {/* Selected pages */}
      {selectedPages.length > 0 && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-[color:var(--foreground)]">
            Selected ({selectedPages.length})
          </label>
          <div className="flex flex-wrap gap-2">
            {selectedPages.map((page) => (
              <span
                key={page.id}
                className="inline-flex items-center gap-1 rounded-[4px] border border-[color:var(--border)] bg-[color:var(--surface)] px-2 py-1 text-xs text-[color:var(--foreground)]"
              >
                {page.icon && <span>{page.icon}</span>}
                {page.title || 'Untitled'}
                <button
                  type="button"
                  onClick={() => togglePage({ id: page.id, title: page.title, icon: page.icon })}
                  className="ml-1 text-[color:var(--text-tertiary)] hover:text-[color:var(--accent-danger)]"
                >
                  x
                </button>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Include child pages toggle */}
      <label className="flex cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={includeChildren}
          onChange={(e) => setIncludeChildren(e.target.checked)}
          className="rounded"
        />
        <div>
          <span className="text-sm font-medium text-[color:var(--foreground)]">Include child pages</span>
          <p className="text-xs text-[color:var(--text-tertiary)]">
            Automatically sync all sub-pages under the selected pages.
          </p>
        </div>
      </label>

      {/* Sync Frequency */}
      <div className="space-y-1">
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
        <p className="text-xs text-[color:var(--text-tertiary)]">How often to automatically sync knowledge from Notion.</p>
      </div>

      {/* Actions */}
      <div className="flex gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handleSave}
          loading={isSaving}
          disabled={selectedPages.length === 0}
        >
          <Save size={14} />
          Save
        </Button>
        <Button
          variant="primary"
          size="sm"
          onClick={() => { void handleSave().then(() => handleSync()) }}
          disabled={selectedPages.length === 0 || isSaving || isSyncing}
        >
          <RefreshCw size={14} />
          Save & Sync
        </Button>
      </div>
    </div>
  )
}
