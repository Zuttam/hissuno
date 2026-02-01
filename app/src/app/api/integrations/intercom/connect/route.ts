/**
 * Intercom connect API route.
 * POST - Validate and save API credentials
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { IntercomClient, IntercomApiError } from '@/lib/integrations/intercom/client'
import {
  storeIntercomCredentials,
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
 * POST /api/integrations/intercom/connect
 * Validate and save Intercom API credentials
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.intercom.connect] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { projectId, accessToken, syncFrequency, filterConfig } = body as {
      projectId: string
      accessToken: string
      syncFrequency: IntercomSyncFrequency
      filterConfig?: IntercomFilterConfig
    }

    // Validate required fields
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }
    if (!accessToken) {
      return NextResponse.json({ error: 'accessToken is required.' }, { status: 400 })
    }
    if (!syncFrequency) {
      return NextResponse.json({ error: 'syncFrequency is required.' }, { status: 400 })
    }

    // Validate sync frequency
    const validFrequencies: IntercomSyncFrequency[] = ['manual', '1h', '6h', '24h']
    if (!validFrequencies.includes(syncFrequency)) {
      return NextResponse.json({ error: 'Invalid syncFrequency.' }, { status: 400 })
    }

    const { supabase } = await resolveUserAndProject(projectId)

    // Test the token by fetching workspace info
    const client = new IntercomClient(accessToken)
    let workspace

    try {
      workspace = await client.testConnection()
    } catch (error) {
      if (error instanceof IntercomApiError) {
        if (error.statusCode === 401) {
          return NextResponse.json({ error: 'Invalid access token.' }, { status: 400 })
        }
        return NextResponse.json(
          { error: `Intercom API error: ${error.message}` },
          { status: 400 }
        )
      }
      throw error
    }

    // Store credentials
    const result = await storeIntercomCredentials(supabase, {
      projectId,
      accessToken,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
      syncFrequency,
      filterConfig,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      workspaceId: workspace.id,
      workspaceName: workspace.name,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    console.error('[integrations.intercom.connect] unexpected error', error)
    return NextResponse.json({ error: 'Failed to connect Intercom.' }, { status: 500 })
  }
}
