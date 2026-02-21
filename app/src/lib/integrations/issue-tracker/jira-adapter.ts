/**
 * Jira Adapter for the generic Issue Tracker interface.
 * Wraps existing Jira code without modifying it.
 */

import type {
  IssueTrackerAdapter,
  TrackerIntegrationStatus,
  TrackerIssueSyncStatus,
  TrackerSyncAction,
  TrackerSyncResult,
} from '@/types/issue-tracker'
import { createAdminClient } from '@/lib/supabase/server'
import { hasJiraConnection, getJiraConnection, getJiraIssueSyncStatus } from '@/lib/integrations/jira'
import { triggerJiraSyncForIssue, manualRetrySync, retryFailedSyncs } from '@/lib/integrations/jira/sync'

export class JiraAdapter implements IssueTrackerAdapter {
  readonly provider = 'jira' as const

  async getIntegrationStatus(projectId: string): Promise<TrackerIntegrationStatus> {
    const supabase = createAdminClient()
    const status = await hasJiraConnection(supabase, projectId)

    return {
      provider: 'jira',
      connected: status.connected,
      isConfigured: status.isConfigured,
      isEnabled: status.isEnabled,
      autoSyncEnabled: status.autoSyncEnabled,
    }
  }

  async syncIssue(issueId: string, projectId: string, action: TrackerSyncAction): Promise<void> {
    triggerJiraSyncForIssue(issueId, projectId, action)
  }

  async getIssueSyncStatus(issueId: string): Promise<TrackerIssueSyncStatus> {
    const supabase = createAdminClient()
    const status = await getJiraIssueSyncStatus(supabase, issueId)

    return {
      provider: 'jira',
      synced: status.synced,
      externalIssueKey: status.jiraIssueKey,
      externalIssueUrl: status.jiraIssueUrl,
      lastSyncStatus: status.lastSyncStatus,
      lastSyncError: status.lastSyncError,
      lastSyncedAt: status.lastSyncedAt,
      lastExternalStatus: status.lastJiraStatus,
      lastWebhookReceivedAt: status.lastWebhookReceivedAt,
      retryCount: status.retryCount,
    }
  }

  async retrySync(issueId: string): Promise<TrackerSyncResult> {
    const result = await manualRetrySync(issueId)
    return {
      success: result.success,
      externalIssueKey: result.jiraIssueKey,
      externalIssueUrl: result.jiraIssueUrl,
      error: result.error,
    }
  }

  async retryAllFailedSyncs(): Promise<{ processed: number; successful: number; failed: number }> {
    return retryFailedSyncs()
  }

  async isAutoSyncEnabled(projectId: string): Promise<boolean> {
    const supabase = createAdminClient()
    const connection = await getJiraConnection(supabase, projectId)
    if (!connection) return false
    if (!connection.is_enabled || !connection.jira_project_key || !connection.issue_type_id) return false
    return connection.auto_sync_enabled !== false
  }
}
