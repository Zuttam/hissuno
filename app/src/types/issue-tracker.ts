/**
 * Generic Issue Tracker Adapter Types
 *
 * Shared interface for Jira, Linear, and future issue tracker integrations.
 */

// ============================================================================
// Provider Types
// ============================================================================

export type IssueTrackerProvider = 'jira' | 'linear'

export type TrackerSyncAction = 'create' | 'update_spec'

// ============================================================================
// Sync Types
// ============================================================================

export interface TrackerSyncResult {
  success: boolean
  externalIssueKey?: string
  externalIssueUrl?: string
  error?: string
}

export interface TrackerIssueSyncStatus {
  provider: IssueTrackerProvider
  synced: boolean
  externalIssueKey: string | null
  externalIssueUrl: string | null
  lastSyncStatus: 'pending' | 'success' | 'failed' | null
  lastSyncError: string | null
  lastSyncedAt: string | null
  lastExternalStatus: string | null
  lastWebhookReceivedAt: string | null
  retryCount: number
}

export interface TrackerIntegrationStatus {
  provider: IssueTrackerProvider
  connected: boolean
  isConfigured: boolean
  isEnabled: boolean
  autoSyncEnabled: boolean
}

// ============================================================================
// Adapter Interface
// ============================================================================

export interface IssueTrackerAdapter {
  readonly provider: IssueTrackerProvider

  /** Check if this tracker is connected and configured for the project */
  getIntegrationStatus(projectId: string): Promise<TrackerIntegrationStatus>

  /** Sync an issue to this tracker (create or update_spec) */
  syncIssue(issueId: string, projectId: string, action: TrackerSyncAction): Promise<void>

  /** Get the sync status for a specific issue */
  getIssueSyncStatus(issueId: string): Promise<TrackerIssueSyncStatus>

  /** Manually retry a failed sync */
  retrySync(issueId: string): Promise<TrackerSyncResult>

  /** Retry all failed syncs (for cron) */
  retryAllFailedSyncs(): Promise<{ processed: number; successful: number; failed: number }>

  /** Check if auto-sync is enabled for this project */
  isAutoSyncEnabled(projectId: string): Promise<boolean>
}
