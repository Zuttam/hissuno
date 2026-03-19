export type ProjectRole = 'owner' | 'member'
export type MemberStatus = 'active' | 'pending'

export interface ProjectMemberRecord {
  id: string
  project_id: string
  user_id: string | null
  role: ProjectRole
  status: MemberStatus
  invited_email: string | null
  invited_by_user_id: string | null
  created_at: string
  updated_at: string
}

export interface ProjectMemberWithProfile extends ProjectMemberRecord {
  user_profile: {
    full_name: string | null
    email: string | null
  } | null
}

export interface ApiKeyRecord {
  id: string
  project_id: string
  created_by_user_id: string
  name: string
  key_prefix: string
  last_used_at: string | null
  expires_at: string | null
  revoked_at: string | null
  created_at: string
}

export interface ApiKeyCreateResult {
  key: ApiKeyRecord
  fullKey: string
}
