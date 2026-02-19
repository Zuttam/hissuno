/**
 * Zendesk integration API routes.
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
  hasZendeskConnection,
  updateZendeskSettings,
  disconnectZendesk,
  getSyncStats,
  type ZendeskSyncFrequency,
  type ZendeskFilterConfig,
} from '@/lib/integrations/zendesk'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/zendesk?projectId=xxx
 * Check Zendesk connection status
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.zendesk.get] Supabase must be configured')
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

    const status = await hasZendeskConnection(supabase, projectId)

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

    console.error('[integrations.zendesk.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to check Zendesk status.' }, { status: 500 })
  }
}

/**
 * PATCH /api/integrations/zendesk
 * Update sync settings
 */
export async function PATCH(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.zendesk.patch] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { projectId, syncFrequency, syncEnabled, filterConfig } = body as {
      projectId: string
      syncFrequency?: ZendeskSyncFrequency
      syncEnabled?: boolean
      filterConfig?: ZendeskFilterConfig
    }

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }

    const identity = await requireUserIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await getClientForIdentity(identity)

    const result = await updateZendeskSettings(supabase, projectId, {
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

    console.error('[integrations.zendesk.patch] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update Zendesk settings.' }, { status: 500 })
  }
}

/**
 * DELETE /api/integrations/zendesk?projectId=xxx
 * Disconnect Zendesk integration
 */
export async function DELETE(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.zendesk.delete] Supabase must be configured')
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

    const result = await disconnectZendesk(supabase, projectId)

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

    console.error('[integrations.zendesk.delete] unexpected error', error)
    return NextResponse.json({ error: 'Failed to disconnect Zendesk.' }, { status: 500 })
  }
}
