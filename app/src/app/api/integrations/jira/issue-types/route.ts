import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { getJiraConnection } from '@/lib/integrations/jira'
import { getJiraIssueTypes } from '@/lib/integrations/jira/client'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/jira/issue-types?projectId=xxx&jiraProjectKey=YYY
 * List issue types for a specific Jira project
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    const jiraProjectKey = request.nextUrl.searchParams.get('jiraProjectKey')

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }
    if (!jiraProjectKey) {
      return NextResponse.json({ error: 'jiraProjectKey is required' }, { status: 400 })
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

    const issueTypes = await getJiraIssueTypes(connection, jiraProjectKey)
    return NextResponse.json({ issueTypes })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error('[integrations.jira.issue-types] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch issue types.' }, { status: 500 })
  }
}
