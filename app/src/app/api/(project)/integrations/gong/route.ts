/**
 * Gong integration API routes.
 * GET - Check connection status
 * PATCH - Update sync settings
 * DELETE - Disconnect integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import {
  hasGongConnection,
  updateGongSettings,
  disconnectGong,
  getSyncStats,
  type SyncFrequency,
  type GongFilterConfig,
} from '@/lib/integrations/gong'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/gong?projectId=xxx
 * Check Gong connection status
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.gong.get] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Get connection status
    const status = await hasGongConnection(projectId)

    // If connected, also get sync stats
    let stats = null
    if (status.connected) {
      stats = await getSyncStats(projectId)
    }

    return NextResponse.json({
      ...status,
      stats,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.gong.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to check Gong status.' }, { status: 500 })
  }
}

/**
 * PATCH /api/integrations/gong
 * Update sync settings
 */
export async function PATCH(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.gong.patch] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { projectId, syncFrequency, syncEnabled, filterConfig } = body as {
      projectId: string
      syncFrequency?: SyncFrequency
      syncEnabled?: boolean
      filterConfig?: GongFilterConfig
    }

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Update settings
    const result = await updateGongSettings(projectId, {
      syncFrequency,
      syncEnabled,
      filterConfig,
    })

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

    console.error('[integrations.gong.patch] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update Gong settings.' }, { status: 500 })
  }
}

/**
 * DELETE /api/integrations/gong?projectId=xxx
 * Disconnect Gong integration
 */
export async function DELETE(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.gong.delete] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Disconnect
    const result = await disconnectGong(projectId)

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

    console.error('[integrations.gong.delete] unexpected error', error)
    return NextResponse.json({ error: 'Failed to disconnect Gong.' }, { status: 500 })
  }
}
