/**
 * Intercom integration API routes.
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
  hasIntercomConnection,
  updateIntercomSettings,
  disconnectIntercom,
  getSyncStats,
  type SyncFrequency,
  type IntercomFilterConfig,
} from '@/lib/integrations/intercom'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/intercom?projectId=xxx
 * Check Intercom connection status
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.intercom.get] Database must be configured')
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
    const status = await hasIntercomConnection(projectId)

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

    console.error('[integrations.intercom.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to check Intercom status.' }, { status: 500 })
  }
}

/**
 * PATCH /api/integrations/intercom
 * Update sync settings
 */
export async function PATCH(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.intercom.patch] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { projectId, syncFrequency, syncEnabled, filterConfig } = body as {
      projectId: string
      syncFrequency?: SyncFrequency
      syncEnabled?: boolean
      filterConfig?: IntercomFilterConfig
    }

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    // Update settings
    const result = await updateIntercomSettings(projectId, {
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

    console.error('[integrations.intercom.patch] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update Intercom settings.' }, { status: 500 })
  }
}

/**
 * DELETE /api/integrations/intercom?projectId=xxx
 * Disconnect Intercom integration
 */
export async function DELETE(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.intercom.delete] Database must be configured')
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
    const result = await disconnectIntercom(projectId)

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

    console.error('[integrations.intercom.delete] unexpected error', error)
    return NextResponse.json({ error: 'Failed to disconnect Intercom.' }, { status: 500 })
  }
}
