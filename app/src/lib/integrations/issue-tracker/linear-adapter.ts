/**
 * Linear Adapter for the generic Issue Tracker interface.
 * Uses Linear sync modules (linear/sync.ts, linear/index.ts).
 */

import type {
  IssueTrackerAdapter,
  TrackerIntegrationStatus,
  TrackerIssueSyncStatus,
  TrackerSyncAction,
  TrackerSyncResult,
} from '@/types/issue-tracker'
import { createAdminClient } from '@/lib/supabase/server'
import { hasLinearConnection, getLinearConnection, getLinearIssueSyncStatus } from '@/lib/integrations/linear'
import { triggerLinearSyncForIssue, manualRetryLinearSync, retryFailedLinearSyncs } from '@/lib/integrations/linear/sync'

export class LinearAdapter implements IssueTrackerAdapter {
  readonly provider = 'linear' as const

  async getIntegrationStatus(projectId: string): Promise<TrackerIntegrationStatus> {
    const supabase = createAdminClient()
    const status = await hasLinearConnection(supabase, projectId)

    return {
      provider: 'linear',
      connected: status.connected,
      isConfigured: status.isConfigured,
      isEnabled: status.isEnabled,
      autoSyncEnabled: status.autoSyncEnabled,
    }
  }

  async syncIssue(issueId: string, projectId: string, action: TrackerSyncAction): Promise<void> {
    triggerLinearSyncForIssue(issueId, projectId, action)
  }

  async getIssueSyncStatus(issueId: string): Promise<TrackerIssueSyncStatus> {
    const supabase = createAdminClient()
    const status = await getLinearIssueSyncStatus(supabase, issueId)

    return {
      provider: 'linear',
      synced: status.synced,
      externalIssueKey: status.linearIssueIdentifier,
      externalIssueUrl: status.linearIssueUrl,
      lastSyncStatus: status.lastSyncStatus,
      lastSyncError: status.lastSyncError,
      lastSyncedAt: status.lastSyncedAt,
      lastExternalStatus: status.lastLinearState,
      lastWebhookReceivedAt: status.lastWebhookReceivedAt,
      retryCount: status.retryCount,
    }
  }

  async retrySync(issueId: string): Promise<TrackerSyncResult> {
    const result = await manualRetryLinearSync(issueId)
    return {
      success: result.success,
      externalIssueKey: result.linearIssueIdentifier,
      externalIssueUrl: result.linearIssueUrl,
      error: result.error,
    }
  }

  async retryAllFailedSyncs(): Promise<{ processed: number; successful: number; failed: number }> {
    return retryFailedLinearSyncs()
  }

  async isAutoSyncEnabled(projectId: string): Promise<boolean> {
    const supabase = createAdminClient()
    const connection = await getLinearConnection(supabase, projectId)
    if (!connection) return false
    if (!connection.is_enabled || !connection.team_id) return false
    return connection.auto_sync_enabled
  }
}
