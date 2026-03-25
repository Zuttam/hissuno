/**
 * Notion integration API routes.
 * GET - Check connection status
 * DELETE - Disconnect integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { hasNotionConnection, disconnectNotion, getNotionSyncConfig, type NotionSyncConfigRow } from '@/lib/integrations/notion'

export const runtime = 'nodejs'

function serializeSyncStatus(config: NotionSyncConfigRow | null) {
  if (!config) return null
  return {
    lastSyncAt: config.last_sync_at?.toISOString() ?? null,
    lastSyncStatus: config.last_sync_status,
    lastSyncCount: config.last_sync_count,
    syncEnabled: config.sync_enabled,
    syncFrequency: config.sync_frequency,
  }
}

/**
 * GET /api/integrations/notion?projectId=xxx
 * Check Notion connection status
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.notion.get] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const status = await hasNotionConnection(projectId)

    let issueSyncConfigured = false
    let knowledgeSyncConfigured = false
    let issueSyncStatus = null
    let knowledgeSyncStatus = null

    if (status.connected) {
      const [issueConfig, knowledgeConfig] = await Promise.all([
        getNotionSyncConfig(projectId, 'issues'),
        getNotionSyncConfig(projectId, 'knowledge'),
      ])
      issueSyncConfigured = !!issueConfig
      knowledgeSyncConfigured = !!knowledgeConfig
      issueSyncStatus = serializeSyncStatus(issueConfig)
      knowledgeSyncStatus = serializeSyncStatus(knowledgeConfig)
    }

    return NextResponse.json({
      connected: status.connected,
      workspaceId: status.workspaceId,
      workspaceName: status.workspaceName,
      authMethod: status.authMethod,
      issueSyncConfigured,
      knowledgeSyncConfigured,
      issueSyncStatus,
      knowledgeSyncStatus,
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

    console.error('[integrations.notion.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to check Notion status.' }, { status: 500 })
  }
}

/**
 * DELETE /api/integrations/notion?projectId=xxx
 * Disconnect Notion integration
 */
export async function DELETE(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.notion.delete] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const result = await disconnectNotion(projectId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

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

    console.error('[integrations.notion.delete] unexpected error', error)
    return NextResponse.json({ error: 'Failed to disconnect Notion.' }, { status: 500 })
  }
}
