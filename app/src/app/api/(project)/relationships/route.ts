import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { isDatabaseConfigured } from '@/lib/db/config'
import {
  linkEntities,
  unlinkEntities,
  getRelatedEntitiesWithDetails,
} from '@/lib/db/queries/entity-relationships'
import type { EntityType } from '@/lib/db/queries/types'

export const runtime = 'nodejs'

const VALID_ENTITY_TYPES: EntityType[] = [
  'company',
  'contact',
  'issue',
  'session',
  'knowledge_source',
  'product_scope',
]

function isValidEntityType(t: unknown): t is EntityType {
  return typeof t === 'string' && VALID_ENTITY_TYPES.includes(t as EntityType)
}

/**
 * POST /api/relationships?projectId=...
 * Link two entities.
 * Body: { source_type, source_id, target_type, target_id }
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = await request.json()
    const { source_type, source_id, target_type, target_id } = body

    if (!isValidEntityType(source_type) || !isValidEntityType(target_type)) {
      return NextResponse.json({ error: 'Invalid entity type.' }, { status: 400 })
    }
    if (source_type === target_type) {
      return NextResponse.json({ error: 'source_type and target_type must differ.' }, { status: 400 })
    }
    if (typeof source_id !== 'string' || typeof target_id !== 'string') {
      return NextResponse.json({ error: 'source_id and target_id are required.' }, { status: 400 })
    }

    await linkEntities(projectId, source_type, source_id, target_type, target_id)

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
    console.error('[relationships.POST] unexpected error', error)
    return NextResponse.json({ error: 'Unable to link entities.' }, { status: 500 })
  }
}

/**
 * DELETE /api/relationships?projectId=...
 * Unlink two entities.
 * Body: { source_type, source_id, target_type, target_id }
 */
export async function DELETE(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = await request.json()
    const { source_type, source_id, target_type, target_id } = body

    if (!isValidEntityType(source_type) || !isValidEntityType(target_type)) {
      return NextResponse.json({ error: 'Invalid entity type.' }, { status: 400 })
    }
    if (typeof source_id !== 'string' || typeof target_id !== 'string') {
      return NextResponse.json({ error: 'source_id and target_id are required.' }, { status: 400 })
    }

    await unlinkEntities(projectId, source_type, source_id, target_type, target_id)

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
    console.error('[relationships.DELETE] unexpected error', error)
    return NextResponse.json({ error: 'Unable to unlink entities.' }, { status: 500 })
  }
}

/**
 * GET /api/relationships?projectId=...&entityType=...&entityId=...
 * Get all related entities (grouped by type with details).
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const { searchParams } = new URL(request.url)
    const entityType = searchParams.get('entityType')
    const entityId = searchParams.get('entityId')

    if (!isValidEntityType(entityType)) {
      return NextResponse.json({ error: 'Invalid entityType.' }, { status: 400 })
    }
    if (!entityId) {
      return NextResponse.json({ error: 'entityId is required.' }, { status: 400 })
    }

    const relationships = await getRelatedEntitiesWithDetails(projectId, entityType, entityId)

    return NextResponse.json({ relationships })
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
    console.error('[relationships.GET] unexpected error', error)
    return NextResponse.json({ error: 'Unable to fetch relationships.' }, { status: 500 })
  }
}
