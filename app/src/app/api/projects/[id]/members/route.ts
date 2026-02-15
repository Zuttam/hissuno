import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured, createAdminClient } from '@/lib/supabase/server'
import { listProjectMembers, addProjectMember } from '@/lib/auth/project-members'

export const runtime = 'nodejs'

type RouteParams = { id: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * GET /api/projects/[id]/members
 *
 * List all members (active and pending) for a project.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const members = await listProjectMembers(projectId)
    return NextResponse.json({ members })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[members.get] unexpected error', projectId, error)
    return NextResponse.json({ error: 'Failed to list members.' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/members
 *
 * Add or invite a member to a project (owner only).
 * If the user exists, creates a pending membership directly.
 * If the user does not exist, claims an invite code and creates a pending membership.
 */
export async function POST(request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId, { requiredRole: 'owner' })

    const body = (await request.json()) as { email?: string; role?: 'owner' | 'member' }

    if (!body.email || typeof body.email !== 'string') {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    const actingUserId = identity.type === 'user' ? identity.userId : identity.createdByUserId
    const supabase = createAdminClient()

    // Look up existing user by email
    const { data: authList, error: authError } = await supabase.auth.admin.listUsers()

    if (authError) {
      console.error('[members.post] failed to list users', authError)
      return NextResponse.json({ error: 'Failed to look up user.' }, { status: 500 })
    }

    const existingUser = authList.users.find(
      (u) => u.email?.toLowerCase() === body.email!.toLowerCase()
    )

    if (existingUser) {
      // User exists - create pending membership directly
      const member = await addProjectMember({
        projectId,
        userId: existingUser.id,
        role: body.role || 'member',
        status: 'pending',
        invitedEmail: body.email,
        invitedByUserId: actingUserId,
      })

      return NextResponse.json({ member, userExists: true }, { status: 201 })
    }

    // User does not exist - need an invite code
    const { data: availableInvites, error: inviteError } = await supabase
      .from('invites')
      .select('id')
      .eq('owner_user_id', actingUserId)
      .is('claimed_by_user_id', null)
      .or('expires_at.is.null,expires_at.gt.now()')
      .limit(1)

    if (inviteError) {
      console.error('[members.post] failed to query invites', inviteError)
      return NextResponse.json({ error: 'Failed to check invite availability.' }, { status: 500 })
    }

    if (!availableInvites || availableInvites.length === 0) {
      return NextResponse.json({ error: 'No invites available.' }, { status: 400 })
    }

    const inviteId = availableInvites[0].id

    // Claim the invite
    const { error: claimError } = await supabase
      .from('invites')
      .update({
        claimed_at: new Date().toISOString(),
        target_email: body.email,
      })
      .eq('id', inviteId)
      .is('claimed_by_user_id', null)

    if (claimError) {
      console.error('[members.post] failed to claim invite', claimError)
      return NextResponse.json({ error: 'Failed to claim invite.' }, { status: 500 })
    }

    // Create pending membership with no user_id
    const member = await addProjectMember({
      projectId,
      userId: null,
      role: body.role || 'member',
      status: 'pending',
      invitedEmail: body.email,
      invitedByUserId: actingUserId,
      signupInviteId: inviteId,
    })

    return NextResponse.json({ member, userExists: false }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[members.post] unexpected error', projectId, error)
    return NextResponse.json({ error: 'Failed to add member.' }, { status: 500 })
  }
}
