'use client'

/**
 * Generic plugin config dialog.
 *
 * Uses the unified /api/plugins/[pluginId] routes to:
 *   - list connections
 *   - create a connection (api_key: in-dialog; oauth2: redirect)
 *   - enable/configure streams with per-stream frequency
 *   - trigger manual sync (SSE)
 *   - disconnect
 *
 * For api_key + oauth2 plugins this replaces the 8 hand-written dialogs.
 * Custom-auth plugins (slack, notion, github) keep their legacy dialogs.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Plug, RefreshCw, Unplug, X } from 'lucide-react'
import { Badge, Button, Dialog, FormField, InlineAlert, Input, Select, Spinner } from '@/components/ui'
import {
  fetchPluginConnections,
  connectPlugin,
  disconnectPluginConnection,
  upsertPluginStream,
  startPluginSync,
  type PluginConnection,
  type PluginConnectionStream,
  type PluginSseEvent,
} from '@/lib/api/plugins'
import type { CatalogPlugin } from '@/app/api/plugins/catalog/route'
import { formatRelativeTime } from '@/lib/utils/format-time'

const FREQ_LABELS: Record<string, string> = {
  manual: 'Manual only',
  '1h': 'Every hour',
  '6h': 'Every 6 hours',
  '24h': 'Daily',
  webhook: 'Webhook-driven',
}

interface Props {
  open: boolean
  onClose: () => void
  projectId: string
  plugin: CatalogPlugin
  onStatusChanged?: () => void
}

export function PluginConfigDialog({ open, onClose, projectId, plugin, onStatusChanged }: Props) {
  const [connections, setConnections] = useState<PluginConnection[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!plugin?.id) return
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPluginConnections(plugin.id, projectId)
      setConnections(Array.isArray(data?.connections) ? data.connections : [])
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }, [plugin?.id, projectId])

  useEffect(() => {
    if (open) void refresh()
  }, [open, refresh])

  const handleConnected = useCallback(async () => {
    await refresh()
    onStatusChanged?.()
  }, [refresh, onStatusChanged])

  if (!plugin) {
    return (
      <Dialog open={open} onClose={onClose} title="Integration" size="md">
        <InlineAlert variant="danger">Plugin metadata failed to load.</InlineAlert>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onClose={onClose} title={`${plugin.name} integration`} size="lg">
      <div className="flex flex-col gap-4">
        {error && <InlineAlert variant="danger">{error}</InlineAlert>}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-[color:var(--text-tertiary)]">
            <Spinner size="sm" />
            Loading…
          </div>
        )}

        <p className="text-sm text-[color:var(--text-secondary)]">{plugin.description}</p>

        {connections.length === 0 ? (
          <ConnectSection plugin={plugin} projectId={projectId} onConnected={handleConnected} />
        ) : (
          <div className="flex flex-col gap-4">
            {connections.map((conn) => (
              <ConnectionCard
                key={conn.id}
                plugin={plugin}
                projectId={projectId}
                connection={conn}
                onChanged={handleConnected}
              />
            ))}
            {plugin.multiInstance && (
              <div className="border-t border-[color:var(--border-subtle)] pt-4">
                <ConnectSection plugin={plugin} projectId={projectId} onConnected={handleConnected} label="Connect another account" />
              </div>
            )}
          </div>
        )}
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Connect section (auth-aware)
// ---------------------------------------------------------------------------

function ConnectSection({
  plugin,
  projectId,
  onConnected,
  label = 'Connect',
}: {
  plugin: CatalogPlugin
  projectId: string
  onConnected: () => void
  label?: string
}) {
  if (plugin.auth.type === 'api_key') {
    return <ApiKeyConnectForm plugin={plugin} projectId={projectId} onConnected={onConnected} submitLabel={label} />
  }
  if (plugin.auth.type === 'oauth2') {
    return <OAuth2ConnectButton plugin={plugin} projectId={projectId} label={label} />
  }
  return (
    <InlineAlert variant="attention">
      This integration uses a custom connect flow. Open the legacy dialog to finish setup.
    </InlineAlert>
  )
}

function ApiKeyConnectForm({
  plugin,
  projectId,
  onConnected,
  submitLabel,
}: {
  plugin: CatalogPlugin
  projectId: string
  onConnected: () => void
  submitLabel: string
}) {
  const fields = plugin.auth.fields ?? []
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((f) => [f.id, '']))
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    setSubmitting(true)
    setError(null)
    try {
      await connectPlugin(plugin.id, projectId, { projectId, credentials: values })
      onConnected()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-3 rounded-[4px] border border-[color:var(--border-subtle)] p-4">
      {error && <InlineAlert variant="danger">{error}</InlineAlert>}
      {fields.map((field) => (
        <FormField key={field.id} label={field.label} supportingText={field.helpText}>
          <Input
            type={field.secret ? 'password' : 'text'}
            placeholder={field.placeholder}
            value={values[field.id] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [field.id]: e.target.value }))}
          />
        </FormField>
      ))}
      <div>
        <Button variant="primary" size="sm" onClick={handleSubmit} loading={submitting}>
          <Plug size={14} />
          {submitLabel}
        </Button>
      </div>
    </div>
  )
}

function OAuth2ConnectButton({
  plugin,
  projectId,
  label,
}: {
  plugin: CatalogPlugin
  projectId: string
  label: string
}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleClick = async () => {
    setLoading(true)
    setError(null)
    try {
      const result = await connectPlugin(plugin.id, projectId, { projectId })
      if (result.authorizeUrl) {
        window.location.href = result.authorizeUrl
      } else {
        setError(result.error ?? 'No authorize URL returned.')
      }
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-[4px] border border-[color:var(--border-subtle)] p-4">
      {error && <InlineAlert variant="danger">{error}</InlineAlert>}
      <div className="flex items-center gap-2">
        <Button variant="primary" size="sm" onClick={handleClick} loading={loading}>
          <Plug size={14} />
          {label} with {plugin.name}
        </Button>
      </div>
      {plugin.auth.scopes && plugin.auth.scopes.length > 0 && (
        <p className="text-xs text-[color:var(--text-tertiary)]">
          Requested scopes: {plugin.auth.scopes.join(', ')}
        </p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Connected-connection card
// ---------------------------------------------------------------------------

function ConnectionCard({
  plugin,
  projectId,
  connection,
  onChanged,
}: {
  plugin: CatalogPlugin
  projectId: string
  connection: PluginConnection
  onChanged: () => void
}) {
  const [disconnecting, setDisconnecting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDisconnect = async () => {
    if (!window.confirm(`Disconnect ${plugin.name} account "${connection.accountLabel}"?`)) return
    setDisconnecting(true)
    setError(null)
    try {
      await disconnectPluginConnection(plugin.id, connection.id, projectId)
      onChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setDisconnecting(false)
    }
  }

  return (
    <div className="rounded-[4px] border border-[color:var(--border-subtle)] p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <Check size={16} className="text-[color:var(--accent-success)]" />
          <div>
            <div className="text-sm font-medium text-[color:var(--foreground)]">{connection.accountLabel}</div>
            <div className="text-xs text-[color:var(--text-tertiary)]">{connection.externalAccountId}</div>
          </div>
        </div>
        <Button variant="ghost" size="sm" onClick={handleDisconnect} loading={disconnecting}>
          <Unplug size={14} />
          Disconnect
        </Button>
      </div>

      {error && (
        <div className="mt-3">
          <InlineAlert variant="danger">{error}</InlineAlert>
        </div>
      )}

      <div className="mt-4 flex flex-col gap-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-tertiary)]">Streams</h4>
        {(plugin.streams ?? []).map((streamDef) => (
          <StreamRow
            key={streamDef.key}
            plugin={plugin}
            projectId={projectId}
            connection={connection}
            streamDef={streamDef}
            onChanged={onChanged}
          />
        ))}
        {(plugin.streams ?? []).length === 0 && (
          <p className="text-xs text-[color:var(--text-tertiary)]">No streams defined for this plugin.</p>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Per-stream controls
// ---------------------------------------------------------------------------

function StreamRow({
  plugin,
  projectId,
  connection,
  streamDef,
  onChanged,
}: {
  plugin: CatalogPlugin
  projectId: string
  connection: PluginConnection
  streamDef: CatalogPlugin['streams'][number]
  onChanged: () => void
}) {
  const existing = useMemo(() => {
    // Match singleton streams (streamId === key) or any instance of a parameterized stream.
    return connection.streams.find((s) => {
      const [base] = s.streamId.split(':')
      return base === streamDef.key
    })
  }, [connection.streams, streamDef.key])

  const [frequency, setFrequency] = useState(existing?.frequency ?? streamDef.frequencies[0] ?? 'manual')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (streamDef.parameterized && !existing) {
      setError('This stream requires an instance (e.g. repo or database). Use the legacy dialog for now.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const instanceId = existing ? parseInstanceId(existing.streamId) : null
      await upsertPluginStream(plugin.id, connection.id, projectId, {
        streamKey: streamDef.key,
        instanceId,
        enabled: true,
        frequency,
      })
      onChanged()
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-[4px] bg-[color:var(--surface-muted)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-[color:var(--foreground)]">{streamDef.label}</span>
            <Badge variant="default">{streamDef.kind}</Badge>
            {streamDef.parameterized && <Badge variant="warning">parameterized</Badge>}
            {existing ? (
              <Badge variant={existing.enabled ? 'success' : 'default'}>
                {existing.enabled ? 'enabled' : 'disabled'}
              </Badge>
            ) : null}
          </div>
          {streamDef.description && (
            <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">{streamDef.description}</p>
          )}
          {existing && <StreamStatus stream={existing} />}
        </div>
        <div className="flex items-center gap-2">
          <Select value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            {streamDef.frequencies.map((f) => (
              <option key={f} value={f}>
                {FREQ_LABELS[f] ?? f}
              </option>
            ))}
          </Select>
          <Button variant="secondary" size="sm" onClick={handleSave} loading={saving}>
            Save
          </Button>
          {existing && (
            <SyncButton plugin={plugin} projectId={projectId} connection={connection} stream={existing} onChanged={onChanged} />
          )}
        </div>
      </div>
      {error && <InlineAlert variant="danger">{error}</InlineAlert>}
    </div>
  )
}

function parseInstanceId(streamId: string): string | null {
  const idx = streamId.indexOf(':')
  return idx < 0 ? null : streamId.slice(idx + 1)
}

function StreamStatus({ stream }: { stream: PluginConnectionStream }) {
  const parts: string[] = []
  if (stream.lastSyncAt) {
    parts.push(`last sync ${formatRelativeTime(stream.lastSyncAt)}`)
  }
  if (stream.lastSyncStatus) {
    parts.push(`status ${stream.lastSyncStatus}`)
  }
  if (stream.nextSyncAt) {
    parts.push(`next ${formatRelativeTime(stream.nextSyncAt)}`)
  }
  if (parts.length === 0) return null
  return (
    <p className="mt-1 text-xs text-[color:var(--text-tertiary)]">{parts.join(' · ')}</p>
  )
}

function SyncButton({
  plugin,
  projectId,
  connection,
  stream,
  onChanged,
}: {
  plugin: CatalogPlugin
  projectId: string
  connection: PluginConnection
  stream: PluginConnectionStream
  onChanged: () => void
}) {
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<PluginSseEvent | null>(null)
  const [cancel, setCancel] = useState<(() => void) | null>(null)

  const handleStart = () => {
    setRunning(true)
    setProgress(null)
    const abort = startPluginSync(plugin.id, connection.id, projectId, {
      streamId: stream.streamId,
      mode: 'incremental',
      onEvent: (evt) => setProgress(evt),
      onError: (err) => {
        setProgress({ type: 'failed', message: err.message })
        setRunning(false)
      },
      onDone: () => {
        setRunning(false)
        onChanged()
      },
    })
    setCancel(() => abort)
  }

  const handleStop = () => {
    cancel?.()
    setRunning(false)
  }

  if (running) {
    return (
      <div className="flex items-center gap-2">
        {progress?.message && (
          <span className="max-w-[180px] truncate text-xs text-[color:var(--text-tertiary)]">
            {progress.message}
          </span>
        )}
        <Button variant="ghost" size="sm" onClick={handleStop}>
          <X size={14} />
          Stop
        </Button>
      </div>
    )
  }
  return (
    <Button variant="primary" size="sm" onClick={handleStart}>
      <RefreshCw size={14} />
      Sync
    </Button>
  )
}
