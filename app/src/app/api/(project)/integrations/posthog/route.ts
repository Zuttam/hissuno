/**
 * PostHog integration API routes.
 * GET - Check connection status
 * PATCH - Update settings (sync frequency, event config)
 * DELETE - Disconnect integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import {
  hasPosthogConnection,
  updatePosthogSettings,
  disconnectPosthog,
  getSyncStats,
  type SyncFrequency,
  type PosthogEventConfig,
} from '@/lib/integrations/posthog'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/posthog?projectId=xxx
 * Check PostHog connection status
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const status = await hasPosthogConnection(projectId)

    let stats = null
    if (status.connected) {
      stats = await getSyncStats(projectId)
    }

    return NextResponse.json({ ...status, stats })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.posthog.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to check PostHog status.' }, { status: 500 })
  }
}

/**
 * PATCH /api/integrations/posthog
 * Update sync settings or event config
 */
export async function PATCH(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { projectId, syncFrequency, syncEnabled, eventConfig, filterConfig } = body as {
      projectId: string
      syncFrequency?: SyncFrequency
      syncEnabled?: boolean
      eventConfig?: PosthogEventConfig
      filterConfig?: Record<string, unknown>
    }

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const result = await updatePosthogSettings(projectId, {
      syncFrequency,
      syncEnabled,
      eventConfig,
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

    console.error('[integrations.posthog.patch] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update PostHog settings.' }, { status: 500 })
  }
}

/**
 * DELETE /api/integrations/posthog?projectId=xxx
 * Disconnect PostHog integration
 */
export async function DELETE(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const result = await disconnectPosthog(projectId)

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

    console.error('[integrations.posthog.delete] unexpected error', error)
    return NextResponse.json({ error: 'Failed to disconnect PostHog.' }, { status: 500 })
  }
}
