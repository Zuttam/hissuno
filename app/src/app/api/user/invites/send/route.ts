import { NextResponse } from 'next/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { UnauthorizedError } from '@/lib/auth/server'
import { ForbiddenError } from '@/lib/auth/authorization'
import { isSupabaseConfigured, createAdminClient } from '@/lib/supabase/server'
import { sendInviteEmailIfNeeded } from '@/lib/notifications/invite-notifications'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireUserIdentity()

    const body = await request.json()
    const { inviteId, recipientEmail } = body as { inviteId?: string; recipientEmail?: string }

    if (!inviteId || !recipientEmail) {
      return NextResponse.json({ error: 'inviteId and recipientEmail are required.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Verify invite belongs to the user and is unclaimed
    const { data: invite, error: fetchError } = await supabase
      .from('invites')
      .select('id, code, owner_user_id, claimed_by_user_id, promotion_code, promotion_description')
      .eq('id', inviteId)
      .single()

    if (fetchError || !invite) {
      return NextResponse.json({ error: 'Invite not found.' }, { status: 404 })
    }

    if (invite.owner_user_id !== identity.userId) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 })
    }

    if (invite.claimed_by_user_id) {
      return NextResponse.json({ error: 'This invite has already been claimed.' }, { status: 400 })
    }

    // Build signup URL with invite code
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://hissuno.com'
    const signupUrl = `${baseUrl}/sign-up?invite=${invite.code}`

    // Send invite email with dedup and tracking
    const result = await sendInviteEmailIfNeeded({
      userId: identity.userId,
      inviteId: invite.id,
      inviteCode: invite.code,
      recipientEmail,
      signupUrl,
      promotionCode: invite.promotion_code ?? undefined,
      promotionDescription: invite.promotion_description ?? undefined,
    })

    if (!result.success) {
      console.error('[api.user.invites.send] email send failed', result.error)
      return NextResponse.json({ error: result.error ?? 'Failed to send invite email.' }, { status: 500 })
    }

    // Update invite's target_email
    await supabase
      .from('invites')
      .update({ target_email: recipientEmail })
      .eq('id', inviteId)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[api.user.invites.send] unexpected error', error)
    return NextResponse.json({ error: 'Failed to send invite.' }, { status: 500 })
  }
}
