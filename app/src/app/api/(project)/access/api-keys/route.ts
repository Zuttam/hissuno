import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { listApiKeys, createApiKey, revokeAllApiKeys } from '@/lib/auth/api-keys'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'

export const runtime = 'nodejs'

/**
 * GET /api/access/api-keys?projectId=...
 *
 * List all API keys for a project (prefix only, no full keys).
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const apiKeys = await listApiKeys(projectId)
    return NextResponse.json({ apiKeys })
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
    console.error('[api-keys.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to list API keys.' }, { status: 500 })
  }
}

/**
 * POST /api/access/api-keys?projectId=...
 *
 * Create a new API key for a project (owner only).
 * Returns the full key once -- it cannot be retrieved again.
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
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
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[api-keys.post] unexpected error', error)
    return NextResponse.json({ error: 'Failed to create API key.' }, { status: 500 })
  }
}

/**
 * DELETE /api/access/api-keys?projectId=...
 *
 * Revoke all API keys for a project (owner only).
 */
export async function DELETE(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId, { requiredRole: 'owner' })

    await revokeAllApiKeys(projectId)
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
    console.error('[api-keys.delete] unexpected error', error)
    return NextResponse.json({ error: 'Failed to revoke API keys.' }, { status: 500 })
  }
}
