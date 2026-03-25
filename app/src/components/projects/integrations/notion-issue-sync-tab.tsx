'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Save, RefreshCw } from 'lucide-react'
import { Button, InlineAlert, Spinner } from '@/components/ui'
import {
  fetchNotionDatabases,
  fetchNotionDatabaseSchema,
  fetchNotionSyncConfig,
  saveNotionSyncConfig,
  notionSyncIssuesUrl,
} from '@/lib/api/integrations'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NotionIssueSyncTabProps {
  projectId: string
}

type TabState = 'loading' | 'not_configured' | 'configuring' | 'configured'
type SyncFrequency = 'manual' | '1h' | '6h' | '24h'

interface NotionDatabase {
  id: string
  title: string
  icon?: string | null
}

interface NotionProperty {
  id: string
  name: string
  type: string
  options?: Array<{ id: string; name: string; color?: string }>
}

interface FieldMapping {
  title?: string
  description?: string
  type?: string
  priority?: string
  status?: string
  typeValueMap?: Record<string, string>
  priorityValueMap?: Record<string, string>
  statusValueMap?: Record<string, string>
  customFields?: string[]
}

interface SyncConfig {
  syncType: string
  notionDatabaseId?: string
  notionDatabaseName?: string
  fieldMapping?: FieldMapping
  syncEnabled?: boolean
  syncFrequency?: string
  lastSyncAt?: string | null
  lastSyncStatus?: string | null
  lastSyncCount?: number | null
  nextSyncAt?: string | null
}

interface SyncProgress {
  type: string
  message: string
  current: number
  total: number
}

const ISSUE_TYPES = ['bug', 'feature_request', 'change_request'] as const
const PRIORITIES = ['low', 'medium', 'high'] as const
const STATUSES = ['open', 'ready', 'in_progress', 'resolved', 'closed'] as const

const FREQUENCY_OPTIONS: Array<{ value: SyncFrequency; label: string }> = [
  { value: 'manual', label: 'Manual only' },
  { value: '1h', label: 'Every hour' },
  { value: '6h', label: 'Every 6 hours' },
  { value: '24h', label: 'Daily' },
]

const LABEL_MAP: Record<string, string> = {
  bug: 'Bug',
  feature_request: 'Feature Request',
  change_request: 'Change Request',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  open: 'Open',
  ready: 'Ready',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
}

const selectClass =
  'w-full rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]'

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function NotionIssueSyncTab({ projectId }: NotionIssueSyncTabProps) {
  const [tabState, setTabState] = useState<TabState>('loading')
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Database list
  const [databases, setDatabases] = useState<NotionDatabase[]>([])
  const [isLoadingDatabases, setIsLoadingDatabases] = useState(false)

  // Selected database + schema
  const [selectedDatabaseId, setSelectedDatabaseId] = useState('')
  const [selectedDatabaseName, setSelectedDatabaseName] = useState('')
  const [properties, setProperties] = useState<NotionProperty[]>([])
  const [isLoadingSchema, setIsLoadingSchema] = useState(false)

  // Field mapping
  const [fieldMapping, setFieldMapping] = useState<FieldMapping>({})

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
      const response = await fetchNotionSyncConfig(projectId, 'issues')
      if (response.ok) {
        const data = await response.json()
        if (data.notionDatabaseId) {
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
  // Load databases when entering configuring state
  // ---------------------------------------------------------------------------

  const loadDatabases = useCallback(async () => {
    setIsLoadingDatabases(true)
    setError(null)
    try {
      const response = await fetchNotionDatabases(projectId)
      if (!response.ok) throw new Error('Failed to fetch databases')
      const data = await response.json()
      setDatabases(data.databases || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load databases')
    } finally {
      setIsLoadingDatabases(false)
    }
  }, [projectId])

  useEffect(() => {
    if (tabState === 'not_configured' || tabState === 'configuring') {
      void loadDatabases()
    }
  }, [tabState, loadDatabases])

  // ---------------------------------------------------------------------------
  // Load schema when database selected
  // ---------------------------------------------------------------------------

  const handleDatabaseChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const dbId = e.target.value
    const db = databases.find((d) => d.id === dbId)
    setSelectedDatabaseId(dbId)
    setSelectedDatabaseName(db?.title || '')
    setProperties([])
    setFieldMapping({})
    setTabState('configuring')

    if (!dbId) return

    setIsLoadingSchema(true)
    setError(null)
    try {
      const response = await fetchNotionDatabaseSchema(projectId, dbId)
      if (!response.ok) throw new Error('Failed to fetch database schema')
      const data = await response.json()
      setProperties(data.properties || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load schema')
    } finally {
      setIsLoadingSchema(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Field mapping helpers
  // ---------------------------------------------------------------------------

  const textProperties = properties.filter((p) => p.type === 'title' || p.type === 'rich_text')
  const enumProperties = properties.filter((p) => p.type === 'select' || p.type === 'status' || p.type === 'multi_select')

  const mappedPropertyNames = new Set(
    [fieldMapping.title, fieldMapping.description, fieldMapping.type, fieldMapping.priority, fieldMapping.status].filter(Boolean)
  )
  const unmappedProperties = properties.filter((p) => !mappedPropertyNames.has(p.name))

  const updateMapping = (field: keyof FieldMapping, value: string) => {
    setFieldMapping((prev) => {
      const next = { ...prev, [field]: value || undefined }
      // Clear value map when the property is cleared
      if (!value) {
        if (field === 'type') delete next.typeValueMap
        if (field === 'priority') delete next.priorityValueMap
        if (field === 'status') delete next.statusValueMap
      }
      return next
    })
  }

  const updateValueMap = (mapKey: 'typeValueMap' | 'priorityValueMap' | 'statusValueMap', notionValue: string, hissunoValue: string) => {
    setFieldMapping((prev) => ({
      ...prev,
      [mapKey]: {
        ...(prev[mapKey] || {}),
        [notionValue]: hissunoValue || undefined,
      },
    }))
  }

  const toggleCustomField = (propName: string, checked: boolean) => {
    setFieldMapping((prev) => {
      const current = prev.customFields || []
      const next = checked ? [...current, propName] : current.filter((n) => n !== propName)
      return { ...prev, customFields: next }
    })
  }

  const getOptionsForProperty = (propName: string | undefined): Array<{ id: string; name: string }> => {
    if (!propName) return []
    const prop = properties.find((p) => p.name === propName)
    return prop?.options || []
  }

  // ---------------------------------------------------------------------------
  // Save configuration
  // ---------------------------------------------------------------------------

  const handleSave = async () => {
    if (!selectedDatabaseId) {
      setError('Please select a database.')
      return
    }
    if (!fieldMapping.title) {
      setError('Title field mapping is required.')
      return
    }

    setIsSaving(true)
    setError(null)

    try {
      const response = await saveNotionSyncConfig({
        projectId,
        syncType: 'issues',
        notionDatabaseId: selectedDatabaseId,
        notionDatabaseName: selectedDatabaseName,
        fieldMapping,
        syncFrequency,
        syncEnabled: true,
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to save configuration')
      }

      setSuccessMessage('Issue sync configured successfully.')
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
        syncType: 'issues',
        notionDatabaseId: syncConfig.notionDatabaseId,
        notionDatabaseName: syncConfig.notionDatabaseName,
        fieldMapping: syncConfig.fieldMapping,
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

    const es = new EventSource(notionSyncIssuesUrl(projectId))
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
    const mapping = syncConfig.fieldMapping || {}
    return (
      <div className="space-y-6">
        {error && <InlineAlert variant="danger">{error}</InlineAlert>}
        {successMessage && <InlineAlert variant="success">{successMessage}</InlineAlert>}

        {/* Config summary */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-[color:var(--foreground)]">Configuration</h4>
          <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-3 space-y-1">
            <p className="text-sm text-[color:var(--text-secondary)]">
              <span className="text-[color:var(--text-tertiary)]">Database:</span>{' '}
              <span className="font-medium">{syncConfig.notionDatabaseName || syncConfig.notionDatabaseId}</span>
            </p>
            {mapping.title && (
              <p className="text-sm text-[color:var(--text-secondary)]">
                <span className="text-[color:var(--text-tertiary)]">Title:</span>{' '}
                <span className="font-medium">{mapping.title}</span>
              </p>
            )}
            {mapping.description && (
              <p className="text-sm text-[color:var(--text-secondary)]">
                <span className="text-[color:var(--text-tertiary)]">Description:</span>{' '}
                <span className="font-medium">{mapping.description}</span>
              </p>
            )}
            {mapping.type && (
              <p className="text-sm text-[color:var(--text-secondary)]">
                <span className="text-[color:var(--text-tertiary)]">Type:</span>{' '}
                <span className="font-medium">{mapping.type}</span>
              </p>
            )}
            {mapping.priority && (
              <p className="text-sm text-[color:var(--text-secondary)]">
                <span className="text-[color:var(--text-tertiary)]">Priority:</span>{' '}
                <span className="font-medium">{mapping.priority}</span>
              </p>
            )}
            {mapping.status && (
              <p className="text-sm text-[color:var(--text-secondary)]">
                <span className="text-[color:var(--text-tertiary)]">Status:</span>{' '}
                <span className="font-medium">{mapping.status}</span>
              </p>
            )}
            {mapping.customFields && mapping.customFields.length > 0 && (
              <p className="text-sm text-[color:var(--text-secondary)]">
                <span className="text-[color:var(--text-tertiary)]">Custom fields:</span>{' '}
                <span className="font-medium">{mapping.customFields.join(', ')}</span>
              </p>
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
                <span className="text-[color:var(--text-secondary)]">Items synced:</span>{' '}
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
  return (
    <div className="space-y-6">
      {error && <InlineAlert variant="danger">{error}</InlineAlert>}
      {successMessage && <InlineAlert variant="success">{successMessage}</InlineAlert>}

      <InlineAlert variant="info">
        Select a Notion database and map its properties to sync issues into Hissuno.
      </InlineAlert>

      {/* Database picker */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-[color:var(--foreground)]">Notion Database</label>
        {isLoadingDatabases ? (
          <div className="flex items-center gap-2 py-2">
            <Spinner size="sm" />
            <span className="text-sm text-[color:var(--text-secondary)]">Loading databases...</span>
          </div>
        ) : (
          <select value={selectedDatabaseId} onChange={handleDatabaseChange} className={selectClass}>
            <option value="">Select a database...</option>
            {databases.map((db) => (
              <option key={db.id} value={db.id}>
                {db.title || 'Untitled'}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Field mapping form */}
      {selectedDatabaseId && (
        isLoadingSchema ? (
          <div className="flex items-center gap-2 py-4">
            <Spinner size="sm" />
            <span className="text-sm text-[color:var(--text-secondary)]">Loading database schema...</span>
          </div>
        ) : properties.length > 0 ? (
          <div className="space-y-5">
            <h4 className="text-sm font-medium text-[color:var(--foreground)]">Field Mapping</h4>

            {/* Title (required) */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-[color:var(--foreground)]">
                Title <span className="text-[color:var(--accent-danger)]">*</span>
              </label>
              <select
                value={fieldMapping.title || ''}
                onChange={(e) => updateMapping('title', e.target.value)}
                className={selectClass}
              >
                <option value="">Select property...</option>
                {textProperties.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} ({p.type})
                  </option>
                ))}
              </select>
              <p className="text-xs text-[color:var(--text-tertiary)]">The Notion property to use as the issue title.</p>
            </div>

            {/* Description (optional) */}
            <div className="space-y-1">
              <label className="text-sm font-medium text-[color:var(--foreground)]">Description</label>
              <select
                value={fieldMapping.description || ''}
                onChange={(e) => updateMapping('description', e.target.value)}
                className={selectClass}
              >
                <option value="">None</option>
                {textProperties.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name} ({p.type})
                  </option>
                ))}
              </select>
            </div>

            {/* Type (optional + value sub-mapping) */}
            <EnumFieldMapping
              label="Type"
              propertyName={fieldMapping.type}
              enumProperties={enumProperties}
              enumValues={ISSUE_TYPES}
              valueMap={fieldMapping.typeValueMap || {}}
              onPropertyChange={(val) => updateMapping('type', val)}
              onValueMapChange={(nv, hv) => updateValueMap('typeValueMap', nv, hv)}
              getOptionsForProperty={getOptionsForProperty}
            />

            {/* Priority (optional + value sub-mapping) */}
            <EnumFieldMapping
              label="Priority"
              propertyName={fieldMapping.priority}
              enumProperties={enumProperties}
              enumValues={PRIORITIES}
              valueMap={fieldMapping.priorityValueMap || {}}
              onPropertyChange={(val) => updateMapping('priority', val)}
              onValueMapChange={(nv, hv) => updateValueMap('priorityValueMap', nv, hv)}
              getOptionsForProperty={getOptionsForProperty}
            />

            {/* Status (optional + value sub-mapping) */}
            <EnumFieldMapping
              label="Status"
              propertyName={fieldMapping.status}
              enumProperties={enumProperties}
              enumValues={STATUSES}
              valueMap={fieldMapping.statusValueMap || {}}
              onPropertyChange={(val) => updateMapping('status', val)}
              onValueMapChange={(nv, hv) => updateValueMap('statusValueMap', nv, hv)}
              getOptionsForProperty={getOptionsForProperty}
            />

            {/* Custom fields */}
            {unmappedProperties.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-[color:var(--foreground)]">Custom Fields</label>
                <p className="text-xs text-[color:var(--text-tertiary)]">
                  Include additional Notion properties as custom fields on synced issues.
                </p>
                <div className="max-h-40 space-y-1 overflow-y-auto rounded-[4px] border border-[color:var(--border-subtle)] p-2">
                  {unmappedProperties.map((p) => (
                    <label key={p.id} className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 hover:bg-[color:var(--surface-hover)]">
                      <input
                        type="checkbox"
                        checked={fieldMapping.customFields?.includes(p.name) || false}
                        onChange={(e) => toggleCustomField(p.name, e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm text-[color:var(--foreground)]">{p.name}</span>
                      <span className="text-xs text-[color:var(--text-tertiary)]">({p.type})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

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
              <p className="text-xs text-[color:var(--text-tertiary)]">How often to automatically sync issues from Notion.</p>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={handleSave}
                loading={isSaving}
                disabled={!fieldMapping.title}
              >
                <Save size={14} />
                Save
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => { void handleSave().then(() => handleSync()) }}
                disabled={!fieldMapping.title || isSaving || isSyncing}
              >
                <RefreshCw size={14} />
                Save & Sync
              </Button>
            </div>
          </div>
        ) : null
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Enum Field Mapping Sub-Component
// ---------------------------------------------------------------------------

interface EnumFieldMappingProps {
  label: string
  propertyName: string | undefined
  enumProperties: NotionProperty[]
  enumValues: readonly string[]
  valueMap: Record<string, string>
  onPropertyChange: (value: string) => void
  onValueMapChange: (notionValue: string, hissunoValue: string) => void
  getOptionsForProperty: (name: string | undefined) => Array<{ id: string; name: string }>
}

function EnumFieldMapping({
  label,
  propertyName,
  enumProperties,
  enumValues,
  valueMap,
  onPropertyChange,
  onValueMapChange,
  getOptionsForProperty,
}: EnumFieldMappingProps) {
  const options = getOptionsForProperty(propertyName)

  return (
    <div className="space-y-2">
      <div className="space-y-1">
        <label className="text-sm font-medium text-[color:var(--foreground)]">{label}</label>
        <select
          value={propertyName || ''}
          onChange={(e) => onPropertyChange(e.target.value)}
          className={selectClass}
        >
          <option value="">None</option>
          {enumProperties.map((p) => (
            <option key={p.id} value={p.name}>
              {p.name} ({p.type})
            </option>
          ))}
        </select>
      </div>

      {/* Value sub-mapping table */}
      {propertyName && options.length > 0 && (
        <div className="ml-4 space-y-1 border-l-2 border-[color:var(--border-subtle)] pl-4">
          <p className="text-xs font-medium text-[color:var(--text-secondary)]">Map Notion values to Hissuno</p>
          {options.map((opt) => (
            <div key={opt.id} className="flex items-center gap-3">
              <span className="w-32 truncate text-sm text-[color:var(--text-secondary)]">{opt.name}</span>
              <span className="text-xs text-[color:var(--text-tertiary)]">-&gt;</span>
              <select
                value={valueMap[opt.name] || ''}
                onChange={(e) => onValueMapChange(opt.name, e.target.value)}
                className="flex-1 rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
              >
                <option value="">Unmapped</option>
                {enumValues.map((v) => (
                  <option key={v} value={v}>
                    {LABEL_MAP[v] || v}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
