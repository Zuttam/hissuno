/**
 * Jira Integration Types
 */

// ============================================================================
// Database Records
// ============================================================================

export interface JiraConnectionRecord {
  id: string
  project_id: string
  cloud_id: string
  site_url: string
  access_token: string
  refresh_token: string
  token_expires_at: string
  jira_project_key: string | null
  jira_project_id: string | null
  issue_type_id: string | null
  issue_type_name: string | null
  is_enabled: boolean
  auto_sync_enabled: boolean
  installed_by_user_id: string | null
  installed_by_email: string | null
  webhook_id: string | null
  webhook_secret: string | null
  created_at: string
  updated_at: string
}

export interface JiraIssueSyncRecord {
  id: string
  issue_id: string
  connection_id: string
  jira_issue_key: string | null
  jira_issue_id: string | null
  jira_issue_url: string | null
  last_sync_action: string | null
  last_sync_status: 'pending' | 'success' | 'failed'
  last_sync_error: string | null
  retry_count: number
  last_synced_at: string | null
  last_jira_status: string | null
  last_webhook_received_at: string | null
  created_at: string
}

// ============================================================================
// API Types
// ============================================================================

export interface JiraIntegrationStatus {
  connected: boolean
  siteUrl: string | null
  cloudId: string | null
  installedByEmail: string | null
  jiraProjectKey: string | null
  jiraProjectId: string | null
  issueTypeName: string | null
  isEnabled: boolean
  isConfigured: boolean
  autoSyncEnabled: boolean
}

export interface JiraProject {
  id: string
  key: string
  name: string
  projectTypeKey: string
}

export interface JiraIssueType {
  id: string
  name: string
  description: string
  subtask: boolean
  iconUrl: string
}

export interface JiraResource {
  id: string
  url: string
  name: string
  scopes: string[]
  avatarUrl: string
}

// ============================================================================
// OAuth Types
// ============================================================================

export interface JiraTokens {
  access_token: string
  refresh_token: string
  expires_in: number
  scope: string
}

export interface JiraOAuthState {
  projectId: string
  userId: string
  nonce: string
  redirectUrl?: string
}

// ============================================================================
// Sync Types
// ============================================================================

export type JiraSyncAction = 'create' | 'update_spec'

export interface JiraSyncResult {
  success: boolean
  jiraIssueKey?: string
  jiraIssueId?: string
  jiraIssueUrl?: string
  error?: string
}

export interface JiraIssueSyncStatus {
  synced: boolean
  jiraIssueKey: string | null
  jiraIssueUrl: string | null
  lastSyncStatus: 'pending' | 'success' | 'failed' | null
  lastSyncError: string | null
  lastSyncedAt: string | null
  lastJiraStatus: string | null
  lastWebhookReceivedAt: string | null
  retryCount: number
}

// ============================================================================
// Jira API Types
// ============================================================================

export interface JiraCreateIssuePayload {
  fields: {
    project: { key: string }
    summary: string
    description: JiraAdfDocument
    issuetype: { id: string }
    labels?: string[]
  }
}

export interface JiraCreatedIssue {
  id: string
  key: string
  self: string
}

/**
 * Atlassian Document Format (ADF) types for Jira descriptions
 */
export interface JiraAdfDocument {
  type: 'doc'
  version: 1
  content: JiraAdfNode[]
}

export interface JiraAdfNode {
  type: string
  content?: JiraAdfNode[]
  text?: string
  marks?: Array<{ type: string; attrs?: Record<string, string> }>
  attrs?: Record<string, unknown>
}

// ============================================================================
// Webhook Types
// ============================================================================

export interface JiraWebhookPayload {
  webhookEvent: string
  issue: {
    id: string
    key: string
    self: string
    fields: {
      labels: string[]
      status: {
        name: string
        statusCategory: {
          key: string
          name: string
        }
      }
      [key: string]: unknown
    }
  }
  changelog?: {
    items: Array<{
      field: string
      fieldtype: string
      from: string | null
      fromString: string | null
      to: string | null
      toString: string | null
    }>
  }
  user?: {
    accountId: string
    displayName: string
  }
  timestamp: number
}
