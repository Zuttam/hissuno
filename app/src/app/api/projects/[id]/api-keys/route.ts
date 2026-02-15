import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { listApiKeys, createApiKey, revokeAllApiKeys } from '@/lib/auth/api-keys'

export const runtime = 'nodejs'

type RouteParams = { id: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * GET /api/projects/[id]/api-keys
 *
 * List all API keys for a project (prefix only, no full keys).
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const apiKeys = await listApiKeys(projectId)
    return NextResponse.json({ apiKeys })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[api-keys.get] unexpected error', projectId, error)
    return NextResponse.json({ error: 'Failed to list API keys.' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/api-keys
 *
 * Create a new API key for a project (owner only).
 * Returns the full key once -- it cannot be retrieved again.
 */
export async function POST(request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId, { requiredRole: 'owner' })

    const body = (await request.json()) as { name?: string; expiresAt?: string }

    if (!body.name || typeof body.name !== 'string') {
      return NextResponse.json({ error: 'Name is required.' }, { status: 400 })
    }

    const actingUserId = identity.type === 'user' ? identity.userId : identity.createdByUserId

    const result = await createApiKey({
      projectId,
      createdByUserId: actingUserId,
      name: body.name,
      expiresAt: body.expiresAt,
    })

    return NextResponse.json({ apiKey: result.key, fullKey: result.fullKey }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[api-keys.post] unexpected error', projectId, error)
    return NextResponse.json({ error: 'Failed to create API key.' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]/api-keys
 *
 * Revoke all API keys for a project (owner only).
 */
export async function DELETE(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId, { requiredRole: 'owner' })

    await revokeAllApiKeys(projectId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[api-keys.delete] unexpected error', projectId, error)
    return NextResponse.json({ error: 'Failed to revoke API keys.' }, { status: 500 })
  }
}
