import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { getJiraConnection } from '@/lib/integrations/jira'
import { getJiraProjects } from '@/lib/integrations/jira/client'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/jira/projects?projectId=xxx
 * List Jira projects accessible to the user
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const identity = await requireUserIdentity()
    await assertProjectAccess(identity, projectId)

    // Get Jira connection
    const connection = await getJiraConnection(projectId)
    if (!connection) {
      return NextResponse.json({ error: 'Jira not connected' }, { status: 400 })
    }

    const jiraProjects = await getJiraProjects(connection)
    return NextResponse.json({ projects: jiraProjects })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[integrations.jira.projects] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch Jira projects.' }, { status: 500 })
  }
}
