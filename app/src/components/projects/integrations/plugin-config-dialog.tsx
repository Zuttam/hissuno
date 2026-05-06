'use client'

/**
 * Generic plugin config dialog.
 *
 * Uses the unified /api/plugins/[pluginId] routes to:
 *   - list connections
 *   - create a connection (api_key: in-dialog; oauth2 + custom: redirect)
 *   - enable/configure streams with per-stream frequency
 *   - trigger manual sync (SSE)
 *   - disconnect
 *
 * Custom-auth plugins (slack, notion, github) use the same redirect flow as
 * oauth2 — their auth.connect handler returns an authorizeUrl.
 */

import { useCallback, useEffect, useState } from 'react'
import { Check, GitBranch, Plug, Plus, Unplug } from 'lucide-react'
import { Button, Dialog, FormField, InlineAlert, Input, Spinner, Text } from '@/components/ui'
import {
  fetchPluginConnections,
  connectPlugin,
  disconnectPluginConnection,
  type PluginConnection,
} from '@/lib/api/plugins'
import { listCodebases, type CodebaseRecord } from '@/lib/api/codebases'
import { CodebaseCreateDialog } from '@/components/projects/codebases/codebase-create-dialog'
import type { CatalogPlugin } from '@/app/api/plugins/catalog/route'

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
  // oauth2 and custom-auth plugins both return an authorizeUrl from connectPlugin().
  return <RedirectConnectButton plugin={plugin} projectId={projectId} label={label} />
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

function RedirectConnectButton({
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

      {plugin.id === 'github' && (
        <GitHubCodebasesSection projectId={projectId} />
      )}

      <div className="mt-4 flex flex-col gap-3">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-tertiary)]">Sync</h4>
        <p className="text-xs text-[color:var(--text-tertiary)]">
          Sync is owned by automation skills. Manage scheduled runs in the
          Automations tab.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Per-stream controls
// ---------------------------------------------------------------------------

// Sync UI removed — sync is owned by automation skills now. The Automations
// tab manages scheduled runs per skill.

// ---------------------------------------------------------------------------
// GitHub-specific: list and create codebases
// ---------------------------------------------------------------------------

function GitHubCodebasesSection({ projectId }: { projectId: string }) {
  const [codebases, setCodebases] = useState<CodebaseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const list = await listCodebases(projectId)
      setCodebases(list.filter((c) => c.kind === 'github'))
    } catch (err) {
      console.error('[github-codebases] failed to load', err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return (
    <div className="mt-4 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-[color:var(--text-tertiary)]">
          Codebases
        </h4>
        <Button variant="secondary" size="sm" onClick={() => setShowCreate(true)}>
          <Plus size={14} />
          Add a codebase
        </Button>
      </div>
      {loading ? (
        <Spinner size="sm" />
      ) : codebases.length === 0 ? (
        <Text variant="muted" size="sm">
          No codebases yet. Add one to make the repo available across this project.
        </Text>
      ) : (
        <div className="flex flex-col gap-1">
          {codebases.map((cb) => (
            <div
              key={cb.id}
              className="flex items-center justify-between rounded-[4px] bg-[color:var(--surface-muted)] px-3 py-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <GitBranch size={14} className="text-[color:var(--text-tertiary)] shrink-0" />
                <span className="text-sm text-[color:var(--foreground)] truncate">
                  {cb.name ?? cb.repository_url ?? 'Untitled codebase'}
                </span>
                {cb.repository_branch && (
                  <span className="text-xs text-[color:var(--text-tertiary)] shrink-0">
                    {cb.repository_branch}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {showCreate && (
        <CodebaseCreateDialog
          open
          projectId={projectId}
          onCloseAction={() => setShowCreate(false)}
          onCreatedAction={() => void refresh()}
        />
      )}
    </div>
  )
}
