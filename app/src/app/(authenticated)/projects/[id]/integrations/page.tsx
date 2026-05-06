'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useProject } from '@/components/providers/project-provider'
import { PageHeader, Spinner } from '@/components/ui'
import { ConnectDropdown } from '@/components/projects/integrations/connect-dropdown'
import { ConnectedList, type ConnectionInfo } from '@/components/projects/integrations/connected-list'
import { Marketplace } from '@/components/projects/integrations/marketplace'
import { INTEGRATION_TYPES } from '@/components/projects/integrations/integration-registry'
import { PluginConfigDialog } from '@/components/projects/integrations/plugin-config-dialog'
import { WidgetConfigDialog } from '@/components/projects/integrations/widget-config-dialog'
import { fetchPluginConnections, type PluginConnection } from '@/lib/api/plugins'
import type { CatalogResponse, CatalogPlugin } from '@/app/api/plugins/catalog/route'

export default function IntegrationsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { project, projectId, isLoading: isLoadingProject } = useProject()

  const [catalog, setCatalog] = useState<CatalogPlugin[]>([])
  const [pluginConnections, setPluginConnections] = useState<PluginConnection[]>([])
  const [activeDialog, setActiveDialog] = useState<{ type: string } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Load the plugin catalog once.
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch('/api/plugins/catalog')
        if (res.ok) {
          const data = (await res.json()) as CatalogResponse
          setCatalog(data.plugins)
        }
      } catch (err) {
        console.error('[integrations] failed to load catalog', err)
      }
    })()
  }, [])

  // Refresh all plugin connections for this project.
  const refreshConnections = useCallback(async () => {
    if (!projectId || catalog.length === 0) return
    try {
      const results = await Promise.all(
        catalog.map((p) =>
          fetchPluginConnections(p.id, projectId)
            .then((r) => (Array.isArray(r?.connections) ? r.connections : []))
            .catch(() => [] as PluginConnection[])
        )
      )
      const all = results.flat().filter((c): c is PluginConnection => Boolean(c?.pluginId))
      setPluginConnections(all)
    } catch (err) {
      console.error('[integrations] failed to refresh connections', err)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, catalog])

  useEffect(() => {
    if (projectId && catalog.length > 0) {
      void refreshConnections()
    }
  }, [projectId, catalog.length, refreshConnections])

  // Auto-open dialog via ?dialog=xxx or OAuth return ?plugin=xxx&connected=1.
  useEffect(() => {
    const dialog = searchParams.get('dialog')
    if (dialog) setActiveDialog({ type: dialog })

    const connectedPlugin = searchParams.get('plugin') && searchParams.get('connected') === '1'
      ? searchParams.get('plugin')
      : null
    if (connectedPlugin && projectId) {
      void refreshConnections()
      setActiveDialog({ type: connectedPlugin })
      router.replace(`/projects/${projectId}/integrations`)
    }
  }, [searchParams, projectId, router, refreshConnections])

  const connections: ConnectionInfo[] = useMemo(
    () =>
      pluginConnections.map((conn) => {
        const marketplaceEntry = INTEGRATION_TYPES.find((t) => t.id === conn.pluginId)
        return {
          id: `${conn.pluginId}:${conn.id}`,
          type: conn.pluginId,
          name: marketplaceEntry?.name ?? conn.pluginId,
          detail: conn.accountLabel ?? conn.externalAccountId,
          status: 'active',
          lastSyncAt: lastSyncFromConnection(conn),
        }
      }),
    [pluginConnections]
  )

  const connectedTypes = useMemo(() => new Set(connections.map((c) => c.type)), [connections])

  const openDialog = useCallback(
    (type: string) => {
      setActiveDialog({ type })
      if (projectId) router.push(`/projects/${projectId}/integrations?dialog=${type}`)
    },
    [router, projectId]
  )

  const handleCloseDialog = useCallback(() => {
    setActiveDialog(null)
    if (projectId && searchParams.get('dialog')) {
      router.replace(`/projects/${projectId}/integrations`)
    }
  }, [router, searchParams, projectId])

  if (isLoadingProject || !project || !projectId || isLoading) {
    return (
      <>
        <PageHeader title="Integrations" />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </>
    )
  }

  const activePlugin = activeDialog ? catalog.find((p) => p.id === activeDialog.type) : null

  return (
    <>
      <PageHeader title="Integrations" actions={<ConnectDropdown onSelect={openDialog} />} />

      <ConnectedList connections={connections} onSelect={openDialog} />

      <hr className="border-[color:var(--border-subtle)]" />

      <Marketplace connectedTypes={connectedTypes} onSelect={openDialog} />

      {activeDialog?.type === 'widget' && (
        <WidgetConfigDialog
          open
          onClose={handleCloseDialog}
          projectId={projectId}
          secretKey={project.secret_key}
          onSaved={refreshConnections}
        />
      )}

      {activeDialog && activePlugin && activeDialog.type !== 'widget' && (
        <PluginConfigDialog
          open
          onClose={handleCloseDialog}
          projectId={projectId}
          plugin={activePlugin}
          onStatusChanged={refreshConnections}
        />
      )}
    </>
  )
}

function lastSyncFromConnection(conn: PluginConnection): string | null {
  let latest: string | null = null
  for (const s of conn.streams) {
    if (!s.lastSyncAt) continue
    if (!latest || new Date(s.lastSyncAt) > new Date(latest)) {
      latest = s.lastSyncAt
    }
  }
  return latest
}
