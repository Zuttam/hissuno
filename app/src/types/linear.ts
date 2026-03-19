/**
 * Linear Integration Types
 */

export type LinearAuthMethod = 'oauth' | 'token'

// ============================================================================
// Database Records
// ============================================================================

export interface LinearConnectionRecord {
  id: string
  project_id: string
  auth_method: LinearAuthMethod
  access_token: string
  refresh_token: string | null
  token_expires_at: string | null
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
  authMethod: LinearAuthMethod | null
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
  redirectUrl?: string
}

