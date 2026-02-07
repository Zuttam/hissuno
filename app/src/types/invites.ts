export interface InviteRecord {
  id: string
  code: string
  owner_user_id: string
  claimed_by_user_id: string | null
  claimed_at: string | null
  expires_at: string | null
  target_email: string | null
  created_at: string
}

export interface InviteWithClaimInfo extends InviteRecord {
  claimed_by_email?: string | null
}

export type PromotionType = 'referral_credit' | 'discount_percent' | 'free_month'
export type PromotionStatus = 'pending' | 'eligible' | 'claimed' | 'expired'

export interface PromotionRecord {
  id: string
  user_id: string
  invite_id: string
  type: PromotionType
  value: number
  status: PromotionStatus
  eligible_at: string | null
  claimed_at: string | null
  expires_at: string | null
  created_at: string
}

export interface InviteValidationResult {
  valid: boolean
  error?: string
  code?: string
}
