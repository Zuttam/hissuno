import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { getLinearConnection } from '@/lib/integrations/linear'
import { getLinearTeams } from '@/lib/integrations/linear/client'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/linear/teams?projectId=xxx
 * List Linear teams for team selection during configuration
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

    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const connection = await getLinearConnection(projectId)
    if (!connection) {
      return NextResponse.json({ error: 'Linear not connected' }, { status: 404 })
    }

    const teams = await getLinearTeams(connection)
    return NextResponse.json({ teams })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[integrations.linear.teams] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch Linear teams.' }, { status: 500 })
  }
}
