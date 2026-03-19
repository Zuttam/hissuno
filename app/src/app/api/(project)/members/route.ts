import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { listProjectMembers, addProjectMember } from '@/lib/auth/project-members'
import { sendProjectInviteEmailIfNeeded } from '@/lib/notifications/project-invite-notifications'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { BCRYPT_ROUNDS } from '@/lib/auth/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/db/schema/auth'
import { projects, userProfiles } from '@/lib/db/schema/app'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

/**
 * GET /api/members?projectId=...
 *
 * List all members (active and pending) for a project.
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const members = await listProjectMembers(projectId)
    return NextResponse.json({ members })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[members.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to list members.' }, { status: 500 })
  }
}

/**
 * POST /api/members?projectId=...
 *
 * Add or invite a member to a project (owner only).
 * If the user exists, creates a pending membership directly.
 * If the user does not exist, creates a pending membership with an email invite.
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId, { requiredRole: 'owner' })

    const body = (await request.json()) as { email?: string; role?: 'owner' | 'member' }

    if (!body.email || typeof body.email !== 'string') {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 })
    }

    const actingUserId = identity.type === 'user' ? identity.userId : identity.createdByUserId

    // Look up existing user by email via Drizzle
    const [existingUserRecord] = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(eq(users.email, body.email!.toLowerCase()))
      .limit(1)

    const existingUser = existingUserRecord ?? null

    // Fetch project name and inviter name for the email
    const [projectRow, inviterProfileRow] = await Promise.all([
      db.query.projects.findFirst({
        where: eq(projects.id, projectId),
        columns: { name: true },
      }),
      db.query.userProfiles.findFirst({
        where: eq(userProfiles.user_id, actingUserId),
        columns: { full_name: true },
      }),
    ])
    const project = projectRow ?? null
    const inviterProfile = inviterProfileRow ? { display_name: inviterProfileRow.full_name } : null

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

    // User does not exist - create account with temporary password, then membership
    const temporaryPassword = crypto.randomBytes(9).toString('base64url')
    const passwordHash = await bcrypt.hash(temporaryPassword, BCRYPT_ROUNDS)
    const emailLower = body.email.toLowerCase()
    const nameFromEmail = emailLower.split('@')[0]

    const [newUser] = await db
      .insert(users)
      .values({
        email: emailLower,
        name: nameFromEmail,
        password_hash: passwordHash,
        emailVerified: new Date(),
      })
      .returning({ id: users.id })

    await db.insert(userProfiles).values({
      user_id: newUser.id,
    })

    const member = await addProjectMember({
      projectId,
      userId: newUser.id,
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
      isNewUser: true,
      temporaryPassword,
    })

    return NextResponse.json({ member, userExists: false }, { status: 201 })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[members.post] unexpected error', error)
    return NextResponse.json({ error: 'Failed to add member.' }, { status: 500 })
  }
}
