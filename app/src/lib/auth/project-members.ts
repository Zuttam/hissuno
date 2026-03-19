import { db } from '@/lib/db'
import { isUniqueViolation } from '@/lib/db/errors'
import { projectMembers, userProfiles } from '@/lib/db/schema/app'
import { users } from '@/lib/db/schema/auth'
import { eq, and, or, asc, inArray, count as drizzleCount } from 'drizzle-orm'
import type { ProjectMemberWithProfile, ProjectRole } from '@/types/project-members'

const LOG_PREFIX = '[project-members]'

/**
 * Activate all pending memberships for a user on sign-in.
 * Matches by user_id OR invited_email so invite-by-email records get linked.
 */
export async function activatePendingMemberships(
  userId: string,
  email: string
): Promise<number> {
  const result = await db
    .update(projectMembers)
    .set({
      status: 'active',
      user_id: userId,
      updated_at: new Date(),
    })
    .where(
      and(
        eq(projectMembers.status, 'pending'),
        or(
          eq(projectMembers.user_id, userId),
          eq(projectMembers.invited_email, email.toLowerCase())
        )
      )
    )
    .returning({ id: projectMembers.id })

  return result.length
}

/**
 * Add a member to a project.
 */
export async function addProjectMember(options: {
  projectId: string
  userId?: string | null
  role?: ProjectRole
  status?: 'active' | 'pending'
  invitedEmail?: string | null
  invitedByUserId?: string | null
}): Promise<{ id: string }> {
  const {
    projectId,
    userId = null,
    role = 'member',
    status = 'active',
    invitedEmail = null,
    invitedByUserId = null,
  } = options

  try {
    const [data] = await db
      .insert(projectMembers)
      .values({
        project_id: projectId,
        user_id: userId,
        role,
        status,
        invited_email: invitedEmail,
        invited_by_user_id: invitedByUserId,
      })
      .returning({ id: projectMembers.id })

    if (!data) {
      throw new Error('Failed to add project member.')
    }

    return { id: data.id }
  } catch (error) {
    // Check for unique constraint violation
    if (isUniqueViolation(error)) {
      throw new Error('User is already a member of this project.')
    }
    console.error(`${LOG_PREFIX} Failed to add member`, error)
    throw new Error('Failed to add project member.')
  }
}

/**
 * Remove a member from a project.
 * Cannot remove the last owner (M2 fix: includes project_id in query).
 */
export async function removeProjectMember(projectId: string, memberId: string): Promise<void> {
  // Check if this is the last owner
  const [member] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.id, memberId),
        eq(projectMembers.project_id, projectId)
      )
    )
    .limit(1)

  if (!member) {
    throw new Error('Member not found.')
  }

  if (member.role === 'owner') {
    const [ownerCount] = await db
      .select({ count: drizzleCount() })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.project_id, projectId),
          eq(projectMembers.role, 'owner'),
          eq(projectMembers.status, 'active')
        )
      )

    if ((ownerCount?.count ?? 0) <= 1) {
      throw new Error('Cannot remove the last owner of a project.')
    }
  }

  const result = await db
    .delete(projectMembers)
    .where(
      and(
        eq(projectMembers.id, memberId),
        eq(projectMembers.project_id, projectId)
      )
    )
    .returning({ id: projectMembers.id })

  if (result.length === 0) {
    console.error(`${LOG_PREFIX} Failed to remove member`, memberId)
    throw new Error('Failed to remove project member.')
  }
}

/**
 * Update a member's role.
 * Cannot demote the last owner (M2 fix: includes project_id in query).
 */
export async function updateMemberRole(
  projectId: string,
  memberId: string,
  newRole: ProjectRole
): Promise<void> {
  // If demoting from owner, check last owner
  const [member] = await db
    .select({ role: projectMembers.role })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.id, memberId),
        eq(projectMembers.project_id, projectId)
      )
    )
    .limit(1)

  if (!member) {
    throw new Error('Member not found.')
  }

  if (member.role === 'owner' && newRole !== 'owner') {
    const [ownerCount] = await db
      .select({ count: drizzleCount() })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.project_id, projectId),
          eq(projectMembers.role, 'owner'),
          eq(projectMembers.status, 'active')
        )
      )

    if ((ownerCount?.count ?? 0) <= 1) {
      throw new Error('Cannot demote the last owner of a project.')
    }
  }

  const result = await db
    .update(projectMembers)
    .set({ role: newRole, updated_at: new Date() })
    .where(
      and(
        eq(projectMembers.id, memberId),
        eq(projectMembers.project_id, projectId)
      )
    )
    .returning({ id: projectMembers.id })

  if (result.length === 0) {
    console.error(`${LOG_PREFIX} Failed to update member role`, memberId)
    throw new Error('Failed to update member role.')
  }
}

/**
 * List all members of a project (active and pending), with user profile info.
 */
export async function listProjectMembers(projectId: string): Promise<ProjectMemberWithProfile[]> {
  const members = await db
    .select()
    .from(projectMembers)
    .where(eq(projectMembers.project_id, projectId))
    .orderBy(asc(projectMembers.created_at))

  if (members.length === 0) {
    return []
  }

  // Fetch user profiles for members that have user_id
  const userIds = members
    .filter((m) => m.user_id)
    .map((m) => m.user_id as string)

  let profileMap: Record<string, { full_name: string | null; email: string | null }> = {}

  if (userIds.length > 0) {
    // Get profiles
    const profiles = await db
      .select({ user_id: userProfiles.user_id, full_name: userProfiles.full_name })
      .from(userProfiles)
      .where(inArray(userProfiles.user_id, userIds))

    // Get emails from users table
    const authUsers = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.id, userIds))

    const emailMap: Record<string, string | null> = {}
    for (const u of authUsers) {
      emailMap[u.id] = u.email
    }

    for (const profile of profiles) {
      profileMap[profile.user_id] = {
        full_name: profile.full_name,
        email: emailMap[profile.user_id] ?? null,
      }
    }
  }

  return members.map((m) => ({
    ...m,
    role: m.role as ProjectRole,
    status: m.status as 'active' | 'pending',
    created_at: m.created_at?.toISOString() ?? '',
    updated_at: m.updated_at?.toISOString() ?? '',
    user_profile: m.user_id ? (profileMap[m.user_id] ?? null) : null,
  })) as ProjectMemberWithProfile[]
}

/**
 * Check if a user has access to a project.
 */
export async function hasProjectAccess(projectId: string, userId: string): Promise<boolean> {
  const [data] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.project_id, projectId),
        eq(projectMembers.user_id, userId),
        eq(projectMembers.status, 'active')
      )
    )
    .limit(1)

  return !!data
}

/**
 * Check if a user has a specific role in a project.
 */
export async function hasProjectRole(
  projectId: string,
  userId: string,
  role: ProjectRole
): Promise<boolean> {
  const [data] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.project_id, projectId),
        eq(projectMembers.user_id, userId),
        eq(projectMembers.role, role),
        eq(projectMembers.status, 'active')
      )
    )
    .limit(1)

  return !!data
}

/**
 * Transfer project ownership from one user to another.
 */
export async function transferOwnership(
  projectId: string,
  fromUserId: string,
  toUserId: string
): Promise<void> {
  // Verify the target is an active member
  const [targetMember] = await db
    .select({ id: projectMembers.id })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.project_id, projectId),
        eq(projectMembers.user_id, toUserId),
        eq(projectMembers.status, 'active')
      )
    )
    .limit(1)

  if (!targetMember) {
    throw new Error('Target user is not an active member of this project.')
  }

  // Promote target to owner
  await db
    .update(projectMembers)
    .set({ role: 'owner', updated_at: new Date() })
    .where(
      and(
        eq(projectMembers.project_id, projectId),
        eq(projectMembers.user_id, toUserId)
      )
    )

  // Demote source to member (only if there will be more than one owner)
  const [ownerCount] = await db
    .select({ count: drizzleCount() })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.project_id, projectId),
        eq(projectMembers.role, 'owner'),
        eq(projectMembers.status, 'active')
      )
    )

  if ((ownerCount?.count ?? 0) > 1) {
    await db
      .update(projectMembers)
      .set({ role: 'member', updated_at: new Date() })
      .where(
        and(
          eq(projectMembers.project_id, projectId),
          eq(projectMembers.user_id, fromUserId)
        )
      )
  }
}
