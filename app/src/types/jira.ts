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
  redirectUrl?: string
}

