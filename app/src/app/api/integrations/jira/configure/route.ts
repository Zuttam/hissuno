import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { configureJiraConnection } from '@/lib/integrations/jira'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/jira/configure
 * Save Jira project and issue type selection
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { projectId, jiraProjectKey, jiraProjectId, issueTypeId, issueTypeName } = body

    if (!projectId || !jiraProjectKey || !jiraProjectId || !issueTypeId || !issueTypeName) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new UnauthorizedError('User not authenticated')
    }

    // Verify user has access to this project (RLS handles membership)
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single()

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const result = await configureJiraConnection(supabase, projectId, {
      jiraProjectKey,
      jiraProjectId,
      issueTypeId,
      issueTypeName,
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    console.error('[integrations.jira.configure] unexpected error', error)
    return NextResponse.json({ error: 'Failed to configure Jira integration.' }, { status: 500 })
  }
}
