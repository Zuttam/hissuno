import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { getJiraConnection } from '@/lib/integrations/jira'
import { getJiraIssueTypes } from '@/lib/integrations/jira/client'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/jira/issue-types?projectId=xxx&jiraProjectKey=YYY
 * List issue types for a specific Jira project
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
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

    const identity = await requireUserIdentity()
    await assertProjectAccess(identity, projectId)

    // Get Jira connection
    const connection = await getJiraConnection(projectId)
    if (!connection) {
      return NextResponse.json({ error: 'Jira not connected' }, { status: 400 })
    }

    const issueTypes = await getJiraIssueTypes(connection, jiraProjectKey)
    return NextResponse.json({ issueTypes })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[integrations.jira.issue-types] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch issue types.' }, { status: 500 })
  }
}
