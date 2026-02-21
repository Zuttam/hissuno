import { NextRequest, NextResponse } from 'next/server'
import { createRequestScopedClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { configureLinearConnection } from '@/lib/integrations/linear'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/linear/configure
 * Save Linear team selection and auto_sync configuration
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { projectId, teamId, teamName, teamKey, autoSyncEnabled } = body

    if (!projectId || !teamId || !teamName || !teamKey) {
      return NextResponse.json({ error: 'projectId, teamId, teamName, and teamKey are required.' }, { status: 400 })
    }

    const { supabase } = await createRequestScopedClient()

    // Verify user has access to this project (RLS handles membership)
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const result = await configureLinearConnection(supabase, projectId, {
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
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error('[integrations.linear.configure] unexpected error', error)
    return NextResponse.json({ error: 'Failed to configure Linear integration.' }, { status: 500 })
  }
}
