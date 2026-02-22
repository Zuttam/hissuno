/**
 * Linear Integration Types
 */

// ============================================================================
// Database Records
// ============================================================================

export interface LinearConnectionRecord {
  id: string
  project_id: string
  access_token: string
  refresh_token: string
  token_expires_at: string
  organization_id: string
  organization_name: string
  team_id: string | null
  team_name: string | null
  team_key: string | null
  is_enabled: boolean
  auto_sync_enabled: boolean
  installed_by_user_id: string | null
  installed_by_email: string | null
  created_at: string
  updated_at: string
}

export interface LinearIssueSyncRecord {
  id: string
  issue_id: string
  connection_id: string
  linear_issue_id: string | null
  linear_issue_identifier: string | null
  linear_issue_url: string | null
  last_sync_action: string | null
  last_sync_status: 'pending' | 'success' | 'failed'
  last_sync_error: string | null
  retry_count: number
  last_synced_at: string | null
  last_linear_state: string | null
  last_linear_state_type: string | null
  last_webhook_received_at: string | null
  created_at: string
}

// ============================================================================
// API Types
// ============================================================================

export interface LinearIntegrationStatus {
  connected: boolean
  organizationId: string | null
  organizationName: string | null
  teamId: string | null
  teamName: string | null
  teamKey: string | null
  isEnabled: boolean
  isConfigured: boolean
  autoSyncEnabled: boolean
}

export interface LinearTeam {
  id: string
  name: string
  key: string
}

export interface LinearWorkflowState {
  id: string
  name: string
  type: string  // 'backlog' | 'unstarted' | 'started' | 'completed' | 'canceled'
}

// ============================================================================
// OAuth Types
// ============================================================================

export interface LinearTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string
  token_type: string
}

export interface LinearOAuthState {
  projectId: string
  userId: string
  nonce: string
  redirectUrl?: string
}

// ============================================================================
// Sync Types
// ============================================================================

export type LinearSyncAction = 'create' | 'update_spec'

export interface LinearSyncResult {
  success: boolean
  linearIssueIdentifier?: string
  linearIssueId?: string
  linearIssueUrl?: string
  error?: string
}

export interface LinearIssueSyncStatus {
  synced: boolean
  linearIssueIdentifier: string | null
  linearIssueUrl: string | null
  lastSyncStatus: 'pending' | 'success' | 'failed' | null
  lastSyncError: string | null
  lastSyncedAt: string | null
  lastLinearState: string | null
  lastLinearStateType: string | null
  lastWebhookReceivedAt: string | null
  retryCount: number
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface LinearWebhookPayload {
  action: 'create' | 'update' | 'remove'
  type: string  // 'Issue', 'Comment', etc.
  data: {
    id: string
    identifier?: string
    title?: string
    url?: string
    state?: {
      id: string
      name: string
      type: string
    }
    labels?: {
      nodes: Array<{
        id: string
        name: string
      }>
    }
    [key: string]: unknown
  }
  updatedFrom?: {
    stateId?: string
    [key: string]: unknown
  }
  organizationId?: string
  webhookTimestamp: number
  webhookId: string
}
