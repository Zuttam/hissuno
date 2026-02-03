import { useState, useEffect, useCallback, useMemo } from 'react'
import type { JiraIssueSyncStatus } from '@/types/jira'

const defaultStatus: JiraIssueSyncStatus = {
  synced: false,
  jiraIssueKey: null,
  jiraIssueUrl: null,
  lastSyncStatus: null,
  lastSyncError: null,
  lastSyncedAt: null,
  lastJiraStatus: null,
  lastWebhookReceivedAt: null,
  retryCount: 0,
}

export function useJiraSyncStatus(projectId: string, issueId: string | null) {
  const [status, setStatus] = useState<JiraIssueSyncStatus>(defaultStatus)
  const [isLoading, setIsLoading] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  const fetchStatus = useCallback(async () => {
    if (!issueId || !projectId) return
    setIsLoading(true)

    try {
      const response = await fetch(
        `/api/projects/${projectId}/issues/${issueId}/jira-status`
      )
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
      }
    } catch (err) {
      console.error('[use-jira-sync] Failed to fetch status:', err)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, issueId])

  useEffect(() => {
    void fetchStatus()
  }, [fetchStatus])

  const retrySync = useCallback(async () => {
    if (!issueId || !projectId) return
    setIsRetrying(true)

    try {
      const response = await fetch(
        `/api/projects/${projectId}/issues/${issueId}/jira-sync`,
        { method: 'POST' }
      )
      if (response.ok) {
        // Refresh status after retry
        await fetchStatus()
      }
    } catch (err) {
      console.error('[use-jira-sync] Failed to retry sync:', err)
    } finally {
      setIsRetrying(false)
    }
  }, [projectId, issueId, fetchStatus])

  return useMemo(
    () => ({ status, isLoading, isRetrying, retrySync, refresh: fetchStatus }),
    [status, isLoading, isRetrying, retrySync, fetchStatus]
  )
}
