import { createAdminClient } from '@/lib/supabase/server'
import type { PromotionRecord } from '@/types/invites'

/**
 * Gets all promotions for a user.
 */
export async function getUserPromotions(userId: string): Promise<PromotionRecord[]> {
  const supabase = createAdminClient()

  const { data: promotions, error } = await supabase
    .from('promotions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[promotion-service.getUserPromotions] Failed to fetch promotions:', error)
    throw new Error('Failed to fetch promotions.')
  }

  return promotions ?? []
}

/**
 * Marks a promotion as eligible when the invitee adds a payment method or subscribes.
 * Called from the Lemon Squeezy webhook when processing first payment.
 */
export async function markPromotionEligible(inviteId: string): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('promotions')
    .update({
      status: 'eligible',
      eligible_at: new Date().toISOString(),
    })
    .eq('invite_id', inviteId)
    .eq('status', 'pending')

  if (error) {
    console.error('[promotion-service.markPromotionEligible] Failed to update promotion:', error)
    throw new Error('Failed to update promotion.')
  }

  console.log(`[promotion-service.markPromotionEligible] Promotion for invite ${inviteId} marked as eligible`)
}

/**
 * Finds the invite used by a user to sign up.
 * Returns the invite ID if found, null otherwise.
 */
export async function findInviteUsedByUser(userId: string): Promise<string | null> {
  const supabase = createAdminClient()

  const { data: invite, error } = await supabase
    .from('invites')
    .select('id')
    .eq('claimed_by_user_id', userId)
    .single()

  if (error || !invite) {
    return null
  }

  return invite.id
}

/**
 * Marks a promotion as claimed.
 */
export async function claimPromotion(promotionId: string): Promise<void> {
  const supabase = createAdminClient()

  const { error } = await supabase
    .from('promotions')
    .update({
      status: 'claimed',
      claimed_at: new Date().toISOString(),
    })
    .eq('id', promotionId)
    .eq('status', 'eligible')

  if (error) {
    console.error('[promotion-service.claimPromotion] Failed to claim promotion:', error)
    throw new Error('Failed to claim promotion.')
  }
}
