import { createAdminClient } from '@/lib/supabase/server'
import type { ProjectMemberWithProfile, ProjectRole } from '@/types/project-members'

const LOG_PREFIX = '[project-members]'

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
  signupInviteId?: string | null
}): Promise<{ id: string }> {
  const {
    projectId,
    userId = null,
    role = 'member',
    status = 'active',
    invitedEmail = null,
    invitedByUserId = null,
    signupInviteId = null,
  } = options

  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('project_members')
    .insert({
      project_id: projectId,
      user_id: userId,
      role,
      status,
      invited_email: invitedEmail,
      invited_by_user_id: invitedByUserId,
      signup_invite_id: signupInviteId,
    })
    .select('id')
    .single()

  if (error) {
    if (error.code === '23505') {
      throw new Error('User is already a member of this project.')
    }
    console.error(`${LOG_PREFIX} Failed to add member`, error)
    throw new Error('Failed to add project member.')
  }

  return { id: data.id }
}

/**
 * Remove a member from a project.
 * Cannot remove the last owner (M2 fix: includes project_id in query).
 */
export async function removeProjectMember(projectId: string, memberId: string): Promise<void> {
  const supabase = createAdminClient()

  // Check if this is the last owner
  const { data: member } = await supabase
    .from('project_members')
    .select('role')
    .eq('id', memberId)
    .eq('project_id', projectId) // M2 fix
    .single()

  if (!member) {
    throw new Error('Member not found.')
  }

  if (member.role === 'owner') {
    const { count } = await supabase
      .from('project_members')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('role', 'owner')
      .eq('status', 'active')

    if ((count ?? 0) <= 1) {
      throw new Error('Cannot remove the last owner of a project.')
    }
  }

  const { error } = await supabase
    .from('project_members')
    .delete()
    .eq('id', memberId)
    .eq('project_id', projectId) // M2 fix

  if (error) {
    console.error(`${LOG_PREFIX} Failed to remove member`, memberId, error)
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
  const supabase = createAdminClient()

  // If demoting from owner, check last owner
  const { data: member } = await supabase
    .from('project_members')
    .select('role')
    .eq('id', memberId)
    .eq('project_id', projectId) // M2 fix
    .single()

  if (!member) {
    throw new Error('Member not found.')
  }

  if (member.role === 'owner' && newRole !== 'owner') {
    const { count } = await supabase
      .from('project_members')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('role', 'owner')
      .eq('status', 'active')

    if ((count ?? 0) <= 1) {
      throw new Error('Cannot demote the last owner of a project.')
    }
  }

  const { error } = await supabase
    .from('project_members')
    .update({ role: newRole, updated_at: new Date().toISOString() })
    .eq('id', memberId)
    .eq('project_id', projectId) // M2 fix

  if (error) {
    console.error(`${LOG_PREFIX} Failed to update member role`, memberId, error)
    throw new Error('Failed to update member role.')
  }
}

/**
 * List all members of a project (active and pending), with user profile info.
 */
export async function listProjectMembers(projectId: string): Promise<ProjectMemberWithProfile[]> {
  const supabase = createAdminClient()

  const { data: members, error } = await supabase
    .from('project_members')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error(`${LOG_PREFIX} Failed to list members`, projectId, error)
    throw new Error('Failed to list project members.')
  }

  if (!members || members.length === 0) {
    return []
  }

  // Fetch user profiles for members that have user_id
  const userIds = members
    .filter((m) => m.user_id)
    .map((m) => m.user_id as string)

  let profileMap: Record<string, { full_name: string | null; email: string | null }> = {}

  if (userIds.length > 0) {
    // Get profiles
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('user_id, full_name')
      .in('user_id', userIds)

    // Get emails via auth admin
    const emailMap: Record<string, string | null> = {}
    for (const uid of userIds) {
      const { data: authUser } = await supabase.auth.admin.getUserById(uid)
      if (authUser?.user) {
        emailMap[uid] = authUser.user.email ?? null
      }
    }

    for (const profile of profiles ?? []) {
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
    user_profile: m.user_id ? (profileMap[m.user_id] ?? null) : null,
  })) as ProjectMemberWithProfile[]
}

/**
 * Get the owner user ID for a project (from projects.user_id).
 * Used for billing enforcement — usage is always counted against the project owner.
 */
export async function getProjectOwnerUserId(projectId: string): Promise<string> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', projectId)
    .single()

  if (error || !data) {
    console.error(`${LOG_PREFIX} getProjectOwnerUserId failed`, { projectId, code: error?.code, message: error?.message })
    throw new Error('Failed to resolve project owner.')
  }

  return data.user_id
}

/**
 * Check if a user has access to a project.
 */
export async function hasProjectAccess(projectId: string, userId: string): Promise<boolean> {
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    console.error(`${LOG_PREFIX} hasProjectAccess query failed`, { projectId, userId, code: error.code, message: error.message })
    throw new Error('Failed to check project access.')
  }

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
  const supabase = createAdminClient()

  const { data, error } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', userId)
    .eq('role', role)
    .eq('status', 'active')
    .maybeSingle()

  if (error) {
    console.error(`${LOG_PREFIX} hasProjectRole query failed`, { projectId, userId, role, code: error.code, message: error.message })
    throw new Error('Failed to check project role.')
  }

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
  const supabase = createAdminClient()

  // Verify the target is an active member
  const { data: targetMember } = await supabase
    .from('project_members')
    .select('id')
    .eq('project_id', projectId)
    .eq('user_id', toUserId)
    .eq('status', 'active')
    .single()

  if (!targetMember) {
    throw new Error('Target user is not an active member of this project.')
  }

  // Promote target to owner
  await supabase
    .from('project_members')
    .update({ role: 'owner', updated_at: new Date().toISOString() })
    .eq('project_id', projectId)
    .eq('user_id', toUserId)

  // Demote source to member (only if there will be more than one owner)
  const { count } = await supabase
    .from('project_members')
    .select('id', { count: 'exact', head: true })
    .eq('project_id', projectId)
    .eq('role', 'owner')
    .eq('status', 'active')

  if ((count ?? 0) > 1) {
    await supabase
      .from('project_members')
      .update({ role: 'member', updated_at: new Date().toISOString() })
      .eq('project_id', projectId)
      .eq('user_id', fromUserId)
  }
}
