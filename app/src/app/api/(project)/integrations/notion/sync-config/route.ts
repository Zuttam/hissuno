/**
 * Notion sync config API route.
 * GET - Fetch sync config for a project + sync type
 * PUT - Upsert sync config
 * DELETE - Delete sync config
 */

import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import {
  getNotionCredentials,
  getNotionSyncConfig,
  upsertNotionSyncConfig,
  deleteNotionSyncConfig,
  type NotionSyncType,
} from '@/lib/integrations/notion'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/notion/sync-config?projectId=xxx&syncType=issues|knowledge
 * Fetch the sync config for a project and sync type
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.notion.sync-config.get] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const syncType = request.nextUrl.searchParams.get('syncType') as NotionSyncType | null
    if (!syncType || (syncType !== 'issues' && syncType !== 'knowledge')) {
      return NextResponse.json({ error: 'syncType must be "issues" or "knowledge".' }, { status: 400 })
    }

    const config = await getNotionSyncConfig(projectId, syncType)

    if (!config) {
      return NextResponse.json({ configured: false })
    }

    return NextResponse.json({
      syncType: config.sync_type,
      notionDatabaseId: config.notion_database_id,
      notionDatabaseName: config.notion_database_name,
      fieldMapping: config.field_mapping,
      notionRootPageIds: config.notion_root_page_ids,
      includeChildren: config.include_children,
      syncEnabled: config.sync_enabled,
      syncFrequency: config.sync_frequency,
      lastSyncAt: config.last_sync_at?.toISOString() ?? null,
      lastSyncStatus: config.last_sync_status,
      lastSyncCount: config.last_sync_count,
      nextSyncAt: config.next_sync_at?.toISOString() ?? null,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('[integrations.notion.sync-config.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch sync config.' }, { status: 500 })
  }
}

/**
 * PUT /api/integrations/notion/sync-config
 * Upsert sync config
 */
export async function PUT(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.notion.sync-config.put] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { projectId, syncType, ...configFields } = body as {
      projectId: string
      syncType: NotionSyncType
      notionDatabaseId?: string
      notionDatabaseName?: string
      fieldMapping?: Record<string, unknown>
      notionRootPageIds?: string[]
      includeChildren?: boolean
      syncEnabled?: boolean
      syncFrequency?: string
    }

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }
    if (!syncType || (syncType !== 'issues' && syncType !== 'knowledge')) {
      return NextResponse.json({ error: 'syncType must be "issues" or "knowledge".' }, { status: 400 })
    }

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Get connection to obtain connectionId
    const credentials = await getNotionCredentials(projectId)
    if (!credentials) {
      return NextResponse.json({ error: 'Notion is not connected for this project.' }, { status: 404 })
    }

    await upsertNotionSyncConfig({
      connectionId: credentials.connectionId,
      projectId,
      syncType,
      notionDatabaseId: configFields.notionDatabaseId,
      notionDatabaseName: configFields.notionDatabaseName,
      fieldMapping: configFields.fieldMapping,
      notionRootPageIds: configFields.notionRootPageIds,
      includeChildren: configFields.includeChildren,
      syncEnabled: configFields.syncEnabled,
      syncFrequency: configFields.syncFrequency as 'manual' | '1h' | '6h' | '24h' | undefined,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('[integrations.notion.sync-config.put] unexpected error', error)
    return NextResponse.json({ error: 'Failed to save sync config.' }, { status: 500 })
  }
}

/**
 * DELETE /api/integrations/notion/sync-config?projectId=xxx&syncType=issues|knowledge
 * Delete sync config
 */
export async function DELETE(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.notion.sync-config.delete] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const syncType = request.nextUrl.searchParams.get('syncType') as NotionSyncType | null
    if (!syncType || (syncType !== 'issues' && syncType !== 'knowledge')) {
      return NextResponse.json({ error: 'syncType must be "issues" or "knowledge".' }, { status: 400 })
    }

    await deleteNotionSyncConfig(projectId, syncType)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('[integrations.notion.sync-config.delete] unexpected error', error)
    return NextResponse.json({ error: 'Failed to delete sync config.' }, { status: 500 })
  }
}
