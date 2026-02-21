import { useState, useEffect, useCallback, useMemo } from 'react'
import type { TrackerIssueSyncStatus, IssueTrackerProvider } from '@/types/issue-tracker'

export function useTrackerSyncStatuses(projectId: string, issueId: string | null) {
  const [statuses, setStatuses] = useState<TrackerIssueSyncStatus[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isPushing, setIsPushing] = useState(false)
  const [isRetrying, setIsRetrying] = useState(false)

  const fetchStatuses = useCallback(async () => {
    if (!issueId || !projectId) return
    setIsLoading(true)

    try {
      const response = await fetch(
        `/api/projects/${projectId}/issues/${issueId}/tracker-status`
      )
      if (response.ok) {
        const data = await response.json()
        setStatuses(data.statuses ?? [])
      }
    } catch (err) {
      console.error('[use-tracker-sync] Failed to fetch statuses:', err)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, issueId])

  useEffect(() => {
    void fetchStatuses()
  }, [fetchStatuses])

  const pushToTracker = useCallback(async (provider: IssueTrackerProvider) => {
    if (!issueId || !projectId) return
    setIsPushing(true)

    try {
      const response = await fetch(
        `/api/projects/${projectId}/issues/${issueId}/tracker-sync`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, action: 'create' }),
        }
      )
      if (response.ok) {
        // Wait a moment then refresh status
        setTimeout(() => void fetchStatuses(), 2000)
      }
    } catch (err) {
      console.error('[use-tracker-sync] Failed to push to tracker:', err)
    } finally {
      setIsPushing(false)
    }
  }, [projectId, issueId, fetchStatuses])

  const retrySync = useCallback(async (provider: IssueTrackerProvider) => {
    if (!issueId || !projectId) return
    setIsRetrying(true)

    try {
      const response = await fetch(
        `/api/projects/${projectId}/issues/${issueId}/tracker-sync`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ provider, action: 'retry' }),
        }
      )
      if (response.ok) {
        await fetchStatuses()
      }
    } catch (err) {
      console.error('[use-tracker-sync] Failed to retry sync:', err)
    } finally {
      setIsRetrying(false)
    }
  }, [projectId, issueId, fetchStatuses])

  return useMemo(
    () => ({ statuses, isLoading, isPushing, isRetrying, pushToTracker, retrySync, refresh: fetchStatuses }),
    [statuses, isLoading, isPushing, isRetrying, pushToTracker, retrySync, fetchStatuses]
  )
}
