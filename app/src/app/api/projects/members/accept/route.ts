import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { UnauthorizedError } from '@/lib/auth/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * POST /api/projects/members/accept
 *
 * Accept a pending project invite.
 * Body: { memberId: string }
 *
 * Security: verifies the caller matches the invite target by user_id or invited_email.
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()

    // Only users can accept invites, not API keys
    if (identity.type !== 'user') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    const body = await request.json().catch(() => null)

    if (!body || typeof body !== 'object' || !body.memberId || typeof body.memberId !== 'string') {
      return NextResponse.json({ error: 'memberId is required.' }, { status: 400 })
    }

    const supabase = createAdminClient()

    // Resolve the caller's email from the auth system
    const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(
      identity.userId
    )

    if (authError || !authUser?.user) {
      console.error('[projects.members.accept] failed to resolve user', authError)
      return NextResponse.json({ error: 'Failed to resolve user.' }, { status: 500 })
    }

    const userEmail = authUser.user.email

    // Update the invite: must match the member ID, be pending, and belong to the caller
    // (matched by user_id or invited_email). This prevents enumeration attacks.
    const { data, error } = await supabase
      .from('project_members')
      .update({
        status: 'active',
        user_id: identity.userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.memberId)
      .eq('status', 'pending')
      .or(`user_id.eq.${identity.userId},invited_email.eq.${userEmail}`)
      .select('id, project_id')
      .single()

    if (error || !data) {
      console.log('[projects.members.accept] no matching invite found', {
        memberId: body.memberId,
        userId: identity.userId,
      })
      return NextResponse.json({ error: 'Invite not found.' }, { status: 404 })
    }

    console.log('[projects.members.accept] invite accepted', {
      memberId: data.id,
      projectId: data.project_id,
      userId: identity.userId,
    })

    return NextResponse.json({ success: true, projectId: data.project_id })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[projects.members.accept] unexpected error', error)
    return NextResponse.json({ error: 'Failed to accept invite.' }, { status: 500 })
  }
}
