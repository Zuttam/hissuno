import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { updateMemberRole, removeProjectMember } from '@/lib/auth/project-members'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'

export const runtime = 'nodejs'

type RouteParams = { memberId: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * PATCH /api/members/[memberId]?projectId=...
 *
 * Update a member's role (owner only).
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { memberId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId, { requiredRole: 'owner' })

    const body = (await request.json()) as { role?: 'owner' | 'member' }

    if (!body.role || (body.role !== 'owner' && body.role !== 'member')) {
      return NextResponse.json({ error: 'Valid role is required ("owner" or "member").' }, { status: 400 })
    }

    await updateMemberRole(projectId, memberId, body.role)
    return NextResponse.json({ success: true })
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
    console.error('[members.patch] unexpected error', memberId, error)
    return NextResponse.json({ error: 'Failed to update member role.' }, { status: 500 })
  }
}

/**
 * DELETE /api/members/[memberId]?projectId=...
 *
 * Remove a member from a project (owner only).
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { memberId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId, { requiredRole: 'owner' })

    await removeProjectMember(projectId, memberId)
    return NextResponse.json({ success: true })
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
    console.error('[members.delete] unexpected error', memberId, error)
    return NextResponse.json({ error: 'Failed to remove member.' }, { status: 500 })
  }
}
