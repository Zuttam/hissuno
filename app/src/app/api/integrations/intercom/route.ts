/**
 * Intercom integration API routes.
 * GET - Check connection status
 * PATCH - Update sync settings
 * DELETE - Disconnect integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError, getClientForIdentity } from '@/lib/auth/authorization'
import {
  hasIntercomConnection,
  updateIntercomSettings,
  disconnectIntercom,
  getSyncStats,
  type IntercomSyncFrequency,
  type IntercomFilterConfig,
} from '@/lib/integrations/intercom'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/intercom?projectId=xxx
 * Check Intercom connection status
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.intercom.get] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }

    const identity = await requireUserIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await getClientForIdentity(identity)

    // Get connection status
    const status = await hasIntercomConnection(supabase, projectId)

    // If connected, also get sync stats
    let stats = null
    if (status.connected) {
      stats = await getSyncStats(supabase, projectId)
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
  if (!isSupabaseConfigured()) {
    console.error('[integrations.intercom.patch] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { projectId, syncFrequency, syncEnabled, filterConfig } = body as {
      projectId: string
      syncFrequency?: IntercomSyncFrequency
      syncEnabled?: boolean
      filterConfig?: IntercomFilterConfig
    }

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }

    const identity = await requireUserIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await getClientForIdentity(identity)

    // Update settings
    const result = await updateIntercomSettings(supabase, projectId, {
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
  if (!isSupabaseConfigured()) {
    console.error('[integrations.intercom.delete] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }

    const identity = await requireUserIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await getClientForIdentity(identity)

    // Disconnect
    const result = await disconnectIntercom(supabase, projectId)

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
