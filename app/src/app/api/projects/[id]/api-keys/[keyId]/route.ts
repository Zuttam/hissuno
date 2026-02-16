import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { revokeApiKey } from '@/lib/auth/api-keys'

export const runtime = 'nodejs'

type RouteParams = { id: string; keyId: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * DELETE /api/projects/[id]/api-keys/[keyId]
 *
 * Revoke a single API key (owner only).
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const { id: projectId, keyId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId, { requiredRole: 'owner' })

    await revokeApiKey(keyId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[api-keys.delete-single] unexpected error', projectId, keyId, error)
    return NextResponse.json({ error: 'Failed to revoke API key.' }, { status: 500 })
  }
}
