/**
 * Issue Tracker Orchestrator
 *
 * Central dispatch for syncing issues to all connected trackers.
 * Replaces direct triggerJiraSyncForIssue calls with a generic approach.
 */

import type {
  IssueTrackerProvider,
  IssueTrackerAdapter,
  TrackerSyncAction,
  TrackerSyncResult,
  TrackerIssueSyncStatus,
  TrackerIntegrationStatus,
} from '@/types/issue-tracker'
import { JiraAdapter } from './jira-adapter'
import { LinearAdapter } from './linear-adapter'

// ============================================================================
// Adapter Registry
// ============================================================================

const adapters: Record<IssueTrackerProvider, IssueTrackerAdapter> = {
  jira: new JiraAdapter(),
  linear: new LinearAdapter(),
}

function getAdapter(provider: IssueTrackerProvider): IssueTrackerAdapter {
  return adapters[provider]
}

// ============================================================================
// Orchestrator Functions
// ============================================================================

/**
 * Fire-and-forget sync to all trackers with auto-sync enabled.
 * Called after issue creation or spec generation.
 */
export function triggerTrackerSyncForIssue(
  issueId: string,
  projectId: string,
  action: TrackerSyncAction
): void {
  void performTrackerSync(issueId, projectId, action)
}

/**
 * Internal: check all adapters and sync if auto-sync is enabled.
 */
async function performTrackerSync(
  issueId: string,
  projectId: string,
  action: TrackerSyncAction
): Promise<void> {
  const providers: IssueTrackerProvider[] = ['jira', 'linear']

  for (const provider of providers) {
    try {
      const adapter = getAdapter(provider)
      const autoSync = await adapter.isAutoSyncEnabled(projectId)
      if (autoSync) {
        await adapter.syncIssue(issueId, projectId, action)
      }
    } catch (error) {
      console.error(`[issue-tracker] Failed to check/sync ${provider} for issue ${issueId}:`, error)
    }
  }
}

/**
 * Manual push to a specific tracker (user-initiated).
 */
export async function pushIssueToTracker(
  issueId: string,
  projectId: string,
  provider: IssueTrackerProvider
): Promise<void> {
  const adapter = getAdapter(provider)
  await adapter.syncIssue(issueId, projectId, 'create')
}

/**
 * Manual retry for a specific tracker (user-initiated).
 */
export async function retryTrackerSync(
  issueId: string,
  provider: IssueTrackerProvider
): Promise<TrackerSyncResult> {
  const adapter = getAdapter(provider)
  return adapter.retrySync(issueId)
}

/**
 * Get sync statuses from all connected trackers for an issue.
 */
export async function getAllTrackerSyncStatuses(
  issueId: string
): Promise<TrackerIssueSyncStatus[]> {
  const providers: IssueTrackerProvider[] = ['jira', 'linear']
  const statuses: TrackerIssueSyncStatus[] = []

  for (const provider of providers) {
    try {
      const adapter = getAdapter(provider)
      const status = await adapter.getIssueSyncStatus(issueId)
      // Only include providers that have a sync record
      if (status.synced || status.lastSyncStatus !== null) {
        statuses.push(status)
      }
    } catch (error) {
      console.error(`[issue-tracker] Failed to get ${provider} status for issue ${issueId}:`, error)
    }
  }

  return statuses
}

/**
 * Get which trackers are connected for a project.
 */
export async function getConnectedTrackers(
  projectId: string
): Promise<TrackerIntegrationStatus[]> {
  const providers: IssueTrackerProvider[] = ['jira', 'linear']
  const connected: TrackerIntegrationStatus[] = []

  for (const provider of providers) {
    try {
      const adapter = getAdapter(provider)
      const status = await adapter.getIntegrationStatus(projectId)
      if (status.connected) {
        connected.push(status)
      }
    } catch (error) {
      console.error(`[issue-tracker] Failed to check ${provider} for project ${projectId}:`, error)
    }
  }

  return connected
}
