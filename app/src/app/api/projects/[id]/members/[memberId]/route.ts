import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { updateMemberRole, removeProjectMember } from '@/lib/auth/project-members'

export const runtime = 'nodejs'

type RouteParams = { id: string; memberId: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * PATCH /api/projects/[id]/members/[memberId]
 *
 * Update a member's role (owner only).
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id: projectId, memberId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId, { requiredRole: 'owner' })

    const body = (await request.json()) as { role?: 'owner' | 'member' }

    if (!body.role || (body.role !== 'owner' && body.role !== 'member')) {
      return NextResponse.json({ error: 'Valid role is required ("owner" or "member").' }, { status: 400 })
    }

    await updateMemberRole(projectId, memberId, body.role)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[members.patch] unexpected error', projectId, memberId, error)
    return NextResponse.json({ error: 'Failed to update member role.' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]/members/[memberId]
 *
 * Remove a member from a project (owner only).
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const { id: projectId, memberId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId, { requiredRole: 'owner' })

    await removeProjectMember(projectId, memberId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[members.delete] unexpected error', projectId, memberId, error)
    return NextResponse.json({ error: 'Failed to remove member.' }, { status: 500 })
  }
}
