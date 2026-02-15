import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured, createAdminClient } from '@/lib/supabase/server'
import { listProjectMembers, addProjectMember } from '@/lib/auth/project-members'
import { createInviteForEmail } from '@/lib/invites/invite-service'
import { sendProjectInviteEmailIfNeeded } from '@/lib/notifications/project-invite-notifications'

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

    // Fetch project name and inviter name for the email
    const [{ data: project }, { data: inviterProfile }] = await Promise.all([
      supabase.from('projects').select('name').eq('id', projectId).single(),
      supabase.from('user_profiles').select('display_name').eq('user_id', actingUserId).single(),
    ])

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

      void sendProjectInviteEmailIfNeeded({
        inviterUserId: actingUserId,
        inviterName: inviterProfile?.display_name ?? null,
        memberId: member.id,
        projectName: project?.name ?? 'Untitled Project',
        recipientEmail: body.email,
        isNewUser: false,
      })

      return NextResponse.json({ member, userExists: true }, { status: 201 })
    }

    // User does not exist - generate invite code on demand
    const { code: inviteCode, inviteId } = await createInviteForEmail(actingUserId, body.email)

    const member = await addProjectMember({
      projectId,
      userId: null,
      role: body.role || 'member',
      status: 'pending',
      invitedEmail: body.email,
      invitedByUserId: actingUserId,
      signupInviteId: inviteId,
    })

    void sendProjectInviteEmailIfNeeded({
      inviterUserId: actingUserId,
      inviterName: inviterProfile?.display_name ?? null,
      memberId: member.id,
      projectName: project?.name ?? 'Untitled Project',
      recipientEmail: body.email,
      isNewUser: true,
      inviteCode,
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
