export interface InviteRecord {
  id: string
  code: string
  owner_user_id: string
  claimed_by_user_id: string | null
  claimed_at: string | null
  expires_at: string | null
  target_email: string | null
  promotion_code: string | null
  promotion_description: string | null
  created_at: string
}

export interface InviteWithClaimInfo extends InviteRecord {
  claimed_by_email?: string | null
}

export interface InviteValidationResult {
  valid: boolean
  error?: string
  code?: string
}
