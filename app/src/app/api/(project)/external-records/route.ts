/**
 * External records lookup + upsert.
 *
 * Used by skill scripts to ask "have I already synced this external_id?" and
 * to persist the mapping after creating a hissuno-side resource.
 *
 * GET    /api/external-records?projectId=...&source=...&resourceType=...&externalId=ID1&externalId=ID2
 *        → { records: ExternalRecord[] }   (one entry per externalId that exists)
 *
 * PUT    /api/external-records?projectId=...
 *        body: { source, externalId, resourceType, resourceId }
 *        → { record: ExternalRecord }
 *
 * Resource POST endpoints automatically upsert when given external_id +
 * external_source per item, so most skills won't need PUT directly.
 */

import type { NextRequest } from 'next/server'
import { NextResponse } from 'next/server'
import { requireProjectId } from '@/lib/auth/project-context'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess } from '@/lib/auth/authorization'
import { isDatabaseConfigured } from '@/lib/db/config'
import {
  findExternalRecords,
  upsertExternalRecord,
  type ExternalResourceType,
} from '@/lib/db/queries/external-records'

export const runtime = 'nodejs'

const VALID_RESOURCE_TYPES: ExternalResourceType[] = [
  'session',
  'contact',
  'company',
  'issue',
  'knowledge',
]

function parseResourceType(value: string | null): ExternalResourceType {
  if (!value || !VALID_RESOURCE_TYPES.includes(value as ExternalResourceType)) {
    const err = new Error(
      `resourceType must be one of: ${VALID_RESOURCE_TYPES.join(', ')}`,
    ) as Error & { status: number }
    err.status = 400
    throw err
  }
  return value as ExternalResourceType
}

export async function GET(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
    }
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const source = request.nextUrl.searchParams.get('source')
    if (!source) {
      return NextResponse.json({ error: 'source query parameter is required.' }, { status: 400 })
    }
    const resourceType = parseResourceType(request.nextUrl.searchParams.get('resourceType'))
    const externalIds = request.nextUrl.searchParams.getAll('externalId')
    if (externalIds.length === 0) {
      return NextResponse.json({ error: 'at least one externalId is required.' }, { status: 400 })
    }

    const rows = await findExternalRecords(projectId, source, resourceType, externalIds)
    return NextResponse.json({
      records: rows.map((r) => ({
        source: r.source,
        externalId: r.external_id,
        resourceType: r.resource_type,
        resourceId: r.resource_id,
        lastSyncedAt: r.last_synced_at,
      })),
    })
  } catch (err) {
    return errorResponse(err)
  }
}

export async function PUT(request: NextRequest) {
  try {
    if (!isDatabaseConfigured()) {
      return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
    }
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = (await request.json().catch(() => ({}))) as {
      source?: string
      externalId?: string
      resourceType?: string
      resourceId?: string
    }
    if (!body.source || !body.externalId || !body.resourceType || !body.resourceId) {
      return NextResponse.json(
        { error: 'source, externalId, resourceType, resourceId are all required.' },
        { status: 400 },
      )
    }
    const resourceType = parseResourceType(body.resourceType)

    const row = await upsertExternalRecord({
      projectId,
      source: body.source,
      externalId: body.externalId,
      resourceType,
      resourceId: body.resourceId,
    })

    return NextResponse.json({
      record: {
        source: row.source,
        externalId: row.external_id,
        resourceType: row.resource_type,
        resourceId: row.resource_id,
        lastSyncedAt: row.last_synced_at,
      },
    })
  } catch (err) {
    return errorResponse(err)
  }
}

function errorResponse(err: unknown): NextResponse {
  const message = err instanceof Error ? err.message : String(err)
  const status = (err as { status?: number })?.status ?? 400
  return NextResponse.json({ error: message }, { status })
}
