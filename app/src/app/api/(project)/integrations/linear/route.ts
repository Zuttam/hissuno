/**
 * Linear integration API routes.
 * GET - Check connection status
 * PATCH - Update team selection and sync settings
 * DELETE - Disconnect integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { hasLinearConnection, disconnectLinear, configureLinearConnection } from '@/lib/integrations/linear'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/linear?projectId=xxx
 * Check if project has Linear integration connected
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const status = await hasLinearConnection(projectId)

    return NextResponse.json(status)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[integrations.linear.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to check integration status.' }, { status: 500 })
  }
}

/**
 * DELETE /api/integrations/linear?projectId=xxx
 * Disconnect Linear integration from project
 */
export async function DELETE(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const result = await disconnectLinear(projectId)

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
    console.error('[integrations.linear.delete] unexpected error', error)
    return NextResponse.json({ error: 'Failed to disconnect Linear.' }, { status: 500 })
  }
}

/**
 * PATCH /api/integrations/linear
 * Update team selection and sync settings
 */
export async function PATCH(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { projectId, teamId, teamName, teamKey, autoSyncEnabled } = body

    if (!projectId || !teamId || !teamName || !teamKey) {
      return NextResponse.json({ error: 'projectId, teamId, teamName, and teamKey are required.' }, { status: 400 })
    }

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const result = await configureLinearConnection(projectId, {
      teamId,
      teamName,
      teamKey,
      autoSyncEnabled: autoSyncEnabled !== undefined ? autoSyncEnabled : true,
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
    console.error('[integrations.linear.patch] unexpected error', error)
    return NextResponse.json({ error: 'Failed to configure Linear integration.' }, { status: 500 })
  }
}
