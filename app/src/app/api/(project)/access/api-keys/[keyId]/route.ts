import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { revokeApiKey } from '@/lib/auth/api-keys'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'

export const runtime = 'nodejs'

type RouteParams = { keyId: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * DELETE /api/access/api-keys/[keyId]?projectId=...
 *
 * Revoke a single API key (owner only).
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { keyId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId, { requiredRole: 'owner' })

    await revokeApiKey(keyId, projectId)
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
    console.error('[api-keys.delete-single] unexpected error', keyId, error)
    return NextResponse.json({ error: 'Failed to revoke API key.' }, { status: 500 })
  }
}
