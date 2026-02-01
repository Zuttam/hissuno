/**
 * Intercom integration API routes.
 * GET - Check connection status
 * PATCH - Update sync settings
 * DELETE - Disconnect integration
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import {
  hasIntercomConnection,
  updateIntercomSettings,
  disconnectIntercom,
  getSyncStats,
  type IntercomSyncFrequency,
  type IntercomFilterConfig,
} from '@/lib/integrations/intercom'

export const runtime = 'nodejs'

async function resolveUserAndProject(projectId: string) {
  const supabase = await createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new UnauthorizedError('User not authenticated')
  }

  // Verify user owns this project
  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('id, user_id')
    .eq('id', projectId)
    .single()

  if (projectError || !project) {
    throw new Error('Project not found')
  }

  if (project.user_id !== user.id) {
    throw new UnauthorizedError('Not authorized to access this project')
  }

  return { supabase, user, project }
}

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

    const { supabase } = await resolveUserAndProject(projectId)

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
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
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

    const { supabase } = await resolveUserAndProject(projectId)

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
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
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

    const { supabase } = await resolveUserAndProject(projectId)

    // Disconnect
    const result = await disconnectIntercom(supabase, projectId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    console.error('[integrations.intercom.delete] unexpected error', error)
    return NextResponse.json({ error: 'Failed to disconnect Intercom.' }, { status: 500 })
  }
}
