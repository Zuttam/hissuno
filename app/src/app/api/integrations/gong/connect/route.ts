/**
 * Gong connect API route.
 * POST - Validate and save API credentials
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { GongClient, GongApiError } from '@/lib/integrations/gong/client'
import {
  storeGongCredentials,
  type GongSyncFrequency,
  type GongFilterConfig,
} from '@/lib/integrations/gong'

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
 * POST /api/integrations/gong/connect
 * Validate and save Gong API credentials
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.gong.connect] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { projectId, accessKey, accessKeySecret, syncFrequency, filterConfig } = body as {
      projectId: string
      accessKey: string
      accessKeySecret: string
      syncFrequency: GongSyncFrequency
      filterConfig?: GongFilterConfig
    }

    // Validate required fields
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required.' }, { status: 400 })
    }
    if (!accessKey) {
      return NextResponse.json({ error: 'accessKey is required.' }, { status: 400 })
    }
    if (!accessKeySecret) {
      return NextResponse.json({ error: 'accessKeySecret is required.' }, { status: 400 })
    }
    if (!syncFrequency) {
      return NextResponse.json({ error: 'syncFrequency is required.' }, { status: 400 })
    }

    // Validate sync frequency
    const validFrequencies: GongSyncFrequency[] = ['manual', '1h', '6h', '24h']
    if (!validFrequencies.includes(syncFrequency)) {
      return NextResponse.json({ error: 'Invalid syncFrequency.' }, { status: 400 })
    }

    const { supabase } = await resolveUserAndProject(projectId)

    // Test the credentials
    const client = new GongClient(accessKey, accessKeySecret)

    try {
      await client.testConnection()
    } catch (error) {
      if (error instanceof GongApiError) {
        if (error.statusCode === 401) {
          return NextResponse.json({ error: 'Invalid API credentials.' }, { status: 400 })
        }
        return NextResponse.json(
          { error: `Gong API error: ${error.message}` },
          { status: 400 }
        )
      }
      throw error
    }

    // Store credentials
    const result = await storeGongCredentials(supabase, {
      projectId,
      accessKey,
      accessKeySecret,
      syncFrequency,
      filterConfig,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    if (error instanceof Error && error.message === 'Project not found') {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    console.error('[integrations.gong.connect] unexpected error', error)
    return NextResponse.json({ error: 'Failed to connect Gong.' }, { status: 500 })
  }
}
