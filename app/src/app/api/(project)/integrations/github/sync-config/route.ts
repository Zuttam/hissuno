/**
 * GitHub sync config CRUD API route.
 */

import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import {
  getGitHubSyncConfig,
  upsertGitHubSyncConfig,
  deleteGitHubSyncConfig,
  getGitHubInstallationUuid,
  type GitHubSyncType,
} from '@/lib/integrations/github'
import type { SyncFrequency } from '@/lib/integrations/shared/sync-constants'

export const runtime = 'nodejs'

async function authenticate(projectId: string) {
  const identity = await requireRequestIdentity()
  await assertProjectAccess(identity, projectId)
  return identity
}

/**
 * GET /api/integrations/github/sync-config?projectId=xxx&syncType=feedback
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  const projectId = request.nextUrl.searchParams.get('projectId')
  const syncType = request.nextUrl.searchParams.get('syncType') as GitHubSyncType | null
  if (!projectId || !syncType) {
    return NextResponse.json({ error: 'projectId and syncType are required.' }, { status: 400 })
  }

  try {
    await authenticate(projectId)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  const config = await getGitHubSyncConfig(projectId, syncType)
  if (!config) {
    return NextResponse.json({ configured: false })
  }

  return NextResponse.json({
    configured: true,
    syncType: config.sync_type,
    githubRepoIds: config.github_repo_ids,
    githubLabelFilter: config.github_label_filter,
    githubLabelTagMap: config.github_label_tag_map,
    syncEnabled: config.sync_enabled,
    syncFrequency: config.sync_frequency,
    lastSyncAt: config.last_sync_at?.toISOString() ?? null,
    lastSyncStatus: config.last_sync_status,
    lastSyncError: config.last_sync_error,
    lastSyncCount: config.last_sync_count,
    nextSyncAt: config.next_sync_at?.toISOString() ?? null,
  })
}

/**
 * PUT /api/integrations/github/sync-config
 */
export async function PUT(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  const body = await request.json()
  const { projectId, syncType, githubRepoIds, githubLabelFilter, githubLabelTagMap, syncEnabled, syncFrequency } = body

  if (!projectId || !syncType) {
    return NextResponse.json({ error: 'projectId and syncType are required.' }, { status: 400 })
  }

  try {
    await authenticate(projectId)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  const installationId = await getGitHubInstallationUuid(projectId)
  if (!installationId) {
    return NextResponse.json({ error: 'GitHub is not connected.' }, { status: 400 })
  }

  const config = await upsertGitHubSyncConfig({
    projectId,
    installationId,
    syncType,
    githubRepoIds: githubRepoIds ?? null,
    githubLabelFilter: githubLabelFilter ?? null,
    githubLabelTagMap: githubLabelTagMap ?? null,
    syncEnabled: syncEnabled ?? true,
    syncFrequency: (syncFrequency as SyncFrequency) ?? 'manual',
  })

  return NextResponse.json({ success: true, id: config.id })
}

/**
 * DELETE /api/integrations/github/sync-config?projectId=xxx&syncType=feedback
 */
export async function DELETE(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  const projectId = request.nextUrl.searchParams.get('projectId')
  const syncType = request.nextUrl.searchParams.get('syncType') as GitHubSyncType | null
  if (!projectId || !syncType) {
    return NextResponse.json({ error: 'projectId and syncType are required.' }, { status: 400 })
  }

  try {
    await authenticate(projectId)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    throw error
  }

  await deleteGitHubSyncConfig(projectId, syncType)
  return NextResponse.json({ success: true })
}
