'use client'

import { useCallback, useEffect, useState } from 'react'
import { fetchPluginConnections } from '@/lib/api/plugins'

export interface IntegrationStatuses {
  widget: boolean
  slack: boolean
  github: boolean
  intercom: boolean
  gong: boolean
  jira: boolean
}

const DEFAULT_STATUSES: IntegrationStatuses = {
  widget: false,
  slack: false,
  github: false,
  intercom: false,
  gong: false,
  jira: false,
}

async function hasAnyConnection(pluginId: string, projectId: string): Promise<boolean> {
  try {
    const data = await fetchPluginConnections(pluginId, projectId)
    return data.connections.length > 0
  } catch {
    return false
  }
}

async function hasWidget(projectId: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/integrations/widget?projectId=${encodeURIComponent(projectId)}`)
    if (!res.ok) return false
    const data = (await res.json()) as { stats?: { hasAnySessions?: boolean; isActive?: boolean } }
    return Boolean(data.stats?.hasAnySessions || data.stats?.isActive)
  } catch {
    return false
  }
}

export function useIntegrationStatuses(projectId: string | null) {
  const [statuses, setStatuses] = useState<IntegrationStatuses>(DEFAULT_STATUSES)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!projectId) return
    setIsLoading(true)
    try {
      const [widget, slack, github, intercom, gong, jira] = await Promise.all([
        hasWidget(projectId),
        hasAnyConnection('slack', projectId),
        hasAnyConnection('github', projectId),
        hasAnyConnection('intercom', projectId),
        hasAnyConnection('gong', projectId),
        hasAnyConnection('jira', projectId),
      ])
      setStatuses({ widget, slack, github, intercom, gong, jira })
    } catch (err) {
      console.error('[use-integration-statuses] Failed to fetch:', err)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return { statuses, isLoading, refresh }
}
