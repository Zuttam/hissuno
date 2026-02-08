'use client'

import { useState, useCallback, useEffect } from 'react'

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

export function useIntegrationStatuses(projectId: string | null) {
  const [statuses, setStatuses] = useState<IntegrationStatuses>(DEFAULT_STATUSES)
  const [isLoading, setIsLoading] = useState(true)

  const refresh = useCallback(async () => {
    if (!projectId) return

    setIsLoading(true)
    try {
      const [widgetRes, slackRes, githubRes, intercomRes, gongRes, jiraRes] = await Promise.all([
        fetch(`/api/projects/${projectId}/sessions?stats=true`),
        fetch(`/api/integrations/slack?projectId=${projectId}`),
        fetch(`/api/integrations/github?projectId=${projectId}`),
        fetch(`/api/integrations/intercom?projectId=${projectId}`),
        fetch(`/api/integrations/gong?projectId=${projectId}`),
        fetch(`/api/integrations/jira?projectId=${projectId}`),
      ])

      const updated = { ...DEFAULT_STATUSES }

      if (widgetRes.ok) {
        const data = await widgetRes.json()
        updated.widget = data.stats?.hasAnySessions ?? false
      }
      if (slackRes.ok) {
        const data = await slackRes.json()
        updated.slack = data.connected ?? false
      }
      if (githubRes.ok) {
        const data = await githubRes.json()
        updated.github = data.connected ?? false
      }
      if (intercomRes.ok) {
        const data = await intercomRes.json()
        updated.intercom = data.connected ?? false
      }
      if (gongRes.ok) {
        const data = await gongRes.json()
        updated.gong = data.connected ?? false
      }
      if (jiraRes.ok) {
        const data = await jiraRes.json()
        updated.jira = data.connected ?? false
      }

      setStatuses(updated)
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
