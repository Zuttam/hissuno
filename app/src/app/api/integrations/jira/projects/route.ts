import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { getJiraConnection } from '@/lib/integrations/jira'
import { getJiraProjects } from '@/lib/integrations/jira/client'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/jira/projects?projectId=xxx
 * List Jira projects accessible to the user
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new UnauthorizedError('User not authenticated')
    }

    // Verify project ownership
    const { data: project } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get Jira connection
    const connection = await getJiraConnection(supabase, projectId)
    if (!connection) {
      return NextResponse.json({ error: 'Jira not connected' }, { status: 400 })
    }

    const jiraProjects = await getJiraProjects(connection)
    return NextResponse.json({ projects: jiraProjects })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error('[integrations.jira.projects] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch Jira projects.' }, { status: 500 })
  }
}
