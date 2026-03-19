import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema/auth'
import { projectMembers } from '@/lib/db/schema/app'
import { eq, and, or } from 'drizzle-orm'

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
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
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

    // Resolve the caller's email from the users table
    const [authUser] = await db
      .select({ email: users.email })
      .from(users)
      .where(eq(users.id, identity.userId))
      .limit(1)

    if (!authUser) {
      console.error('[projects.members.accept] failed to resolve user', identity.userId)
      return NextResponse.json({ error: 'Failed to resolve user.' }, { status: 500 })
    }

    const userEmail = authUser.email

    // Update the invite: must match the member ID, be pending, and belong to the caller
    // (matched by user_id or invited_email). This prevents enumeration attacks.
    const [updated] = await db
      .update(projectMembers)
      .set({
        status: 'active',
        user_id: identity.userId,
        updated_at: new Date(),
      })
      .where(
        and(
          eq(projectMembers.id, body.memberId),
          eq(projectMembers.status, 'pending'),
          or(
            eq(projectMembers.user_id, identity.userId),
            eq(projectMembers.invited_email, userEmail!)
          )
        )
      )
      .returning({ id: projectMembers.id, project_id: projectMembers.project_id })

    if (!updated) {
      console.log('[projects.members.accept] no matching invite found', {
        memberId: body.memberId,
        userId: identity.userId,
      })
      return NextResponse.json({ error: 'Invite not found.' }, { status: 404 })
    }

    console.log('[projects.members.accept] invite accepted', {
      memberId: updated.id,
      projectId: updated.project_id,
      userId: identity.userId,
    })

    return NextResponse.json({ success: true, projectId: updated.project_id })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[projects.members.accept] unexpected error', error)
    return NextResponse.json({ error: 'Failed to accept invite.' }, { status: 500 })
  }
}
