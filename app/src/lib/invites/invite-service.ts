import { createAdminClient } from '@/lib/supabase/server'
import type { InviteRecord, InviteWithClaimInfo, InviteValidationResult } from '@/types/invites'

/**
 * Generates a random 8-character alphanumeric invite code.
 * Used for manual DB inserts by admin.
 */
export function generateInviteCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Excluding confusing chars: 0, O, I, 1
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

/**
 * Creates an invite code for a specific email address.
 * Used to auto-generate invites when someone joins the waitlist.
 */
export async function createInviteForEmail(ownerUserId: string, targetEmail: string): Promise<string> {
  const supabase = createAdminClient()
  const code = generateInviteCode()

  const { error } = await supabase.from('invites').insert({
    code,
    owner_user_id: ownerUserId,
    target_email: targetEmail,
  })

  if (error) {
    console.error('[invite-service.createInviteForEmail] Failed to create invite:', error)
    throw new Error('Failed to create invite.')
  }

  console.log(`[invite-service.createInviteForEmail] Created invite ${code} for ${targetEmail}`)
  return code
}

/**
 * Validates an invite code for signup.
 * Checks if the code exists, is not already claimed, and is not expired.
 */
export async function validateInviteCode(code: string): Promise<InviteValidationResult> {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'Invalid invite code.' }
  }

  const normalizedCode = code.trim().toUpperCase()
  if (normalizedCode.length !== 8) {
    return { valid: false, error: 'Invalid invite code format.' }
  }

  const supabase = createAdminClient()

  const { data: invite, error } = await supabase
    .from('invites')
    .select('*')
    .eq('code', normalizedCode)
    .single()

  if (error || !invite) {
    return { valid: false, error: 'Invite code not found.' }
  }

  // Check if already claimed
  if (invite.claimed_by_user_id) {
    return { valid: false, error: 'This invite code has already been used.' }
  }

  // Check if expired
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { valid: false, error: 'This invite code has expired.' }
  }

  return { valid: true, code: normalizedCode }
}

/**
 * Claims an invite code for a user after successful signup.
 */
export async function claimInvite(code: string, userId: string): Promise<void> {
  const normalizedCode = code.trim().toUpperCase()
  const supabase = createAdminClient()

  // Get the invite to find the owner
  const { data: invite, error: fetchError } = await supabase
    .from('invites')
    .select('id, owner_user_id, claimed_by_user_id')
    .eq('code', normalizedCode)
    .single()

  if (fetchError || !invite) {
    console.error('[invite-service.claimInvite] Invite not found:', normalizedCode)
    throw new Error('Invite not found.')
  }

  // Double-check it's not already claimed
  if (invite.claimed_by_user_id) {
    console.error('[invite-service.claimInvite] Invite already claimed:', normalizedCode)
    throw new Error('Invite already claimed.')
  }

  // Mark the invite as claimed
  const { error: updateError } = await supabase
    .from('invites')
    .update({
      claimed_by_user_id: userId,
      claimed_at: new Date().toISOString(),
    })
    .eq('id', invite.id)

  if (updateError) {
    console.error('[invite-service.claimInvite] Failed to claim invite:', updateError)
    throw new Error('Failed to claim invite.')
  }

  // Activate the user's profile
  const { error: activateError } = await supabase
    .from('user_profiles')
    .upsert({ user_id: userId, is_activated: true }, { onConflict: 'user_id' })

  if (activateError) {
    console.error('[invite-service.claimInvite] Failed to activate user profile:', activateError)
  }

  console.log(`[invite-service.claimInvite] Invite ${normalizedCode} claimed by user ${userId}`)
}

/**
 * Gets all invites owned by a user with claim information.
 */
export async function getUserInvites(userId: string): Promise<InviteWithClaimInfo[]> {
  const supabase = createAdminClient()

  // Get invites
  const { data: invites, error } = await supabase
    .from('invites')
    .select('*')
    .eq('owner_user_id', userId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[invite-service.getUserInvites] Failed to fetch invites:', error)
    throw new Error('Failed to fetch invites.')
  }

  if (!invites || invites.length === 0) {
    return []
  }

  // Get emails for claimed invites
  const claimedUserIds = invites
    .filter((inv) => inv.claimed_by_user_id)
    .map((inv) => inv.claimed_by_user_id)
    .filter(Boolean) as string[]

  let emailMap: Record<string, string> = {}

  if (claimedUserIds.length > 0) {
    // Use auth.users table via admin client to get emails
    const { data: users, error: usersError } = await supabase.auth.admin.listUsers()

    if (!usersError && users?.users) {
      for (const user of users.users) {
        if (claimedUserIds.includes(user.id) && user.email) {
          emailMap[user.id] = user.email
        }
      }
    }
  }

  // Map invites with claim info
  return invites.map((invite) => ({
    ...invite,
    claimed_by_email: invite.claimed_by_user_id
      ? emailMap[invite.claimed_by_user_id] ?? null
      : null,
  }))
}

/**
 * Checks whether a user has been activated (signed up with a valid invite code).
 */
export async function isUserActivated(userId: string): Promise<boolean> {
  const supabase = createAdminClient()
  const { data } = await supabase
    .from('user_profiles')
    .select('is_activated')
    .eq('user_id', userId)
    .single()
  return data?.is_activated === true
}
