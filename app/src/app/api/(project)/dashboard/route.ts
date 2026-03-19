import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { getIssueVelocityData } from '@/lib/db/queries/analytics'
import type { AnalyticsPeriod } from '@/lib/db/queries/analytics'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    const projectId = requireProjectId(request)
    await assertProjectAccess(identity, projectId)

    const period = (request.nextUrl.searchParams.get('period') || '30d') as AnalyticsPeriod

    const velocity = await getIssueVelocityData(projectId, period)

    return NextResponse.json({
      velocity,
    })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[dashboard.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load dashboard data.' }, { status: 500 })
  }
}
