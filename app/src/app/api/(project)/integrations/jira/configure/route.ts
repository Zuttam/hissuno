import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { configureJiraConnection } from '@/lib/integrations/jira'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/jira/configure
 * Save Jira project and issue type selection
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { projectId, jiraProjectKey, jiraProjectId, issueTypeId, issueTypeName, autoSyncEnabled } = body

    if (!projectId || !jiraProjectKey || !jiraProjectId || !issueTypeId || !issueTypeName) {
      return NextResponse.json({ error: 'All fields are required.' }, { status: 400 })
    }

    const identity = await requireUserIdentity()
    await assertProjectAccess(identity, projectId)

    const result = await configureJiraConnection(projectId, {
      jiraProjectKey,
      jiraProjectId,
      issueTypeId,
      issueTypeName,
      autoSyncEnabled: typeof autoSyncEnabled === 'boolean' ? autoSyncEnabled : undefined,
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
    console.error('[integrations.jira.configure] unexpected error', error)
    return NextResponse.json({ error: 'Failed to configure Jira integration.' }, { status: 500 })
  }
}
