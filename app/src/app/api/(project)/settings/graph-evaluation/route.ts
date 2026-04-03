import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import {
  getGraphEvaluationSettings,
  updateGraphEvaluationSettings,
} from '@/lib/db/queries/graph-evaluation-settings'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const settings = await getGraphEvaluationSettings(projectId)
    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof MissingProjectIdError) return NextResponse.json({ error: error.message }, { status: 400 })
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    console.error('[settings.graph-evaluation] GET error', error)
    return NextResponse.json({ error: 'Failed to fetch graph evaluation settings.' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = await request.json()
    const { creation_policy_enabled } = body

    const updated = await updateGraphEvaluationSettings(projectId, {
      creation_policy_enabled,
    })

    return NextResponse.json({ settings: updated })
  } catch (error) {
    if (error instanceof MissingProjectIdError) return NextResponse.json({ error: error.message }, { status: 400 })
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    console.error('[settings.graph-evaluation] PATCH error', error)
    return NextResponse.json({ error: 'Failed to update graph evaluation settings.' }, { status: 500 })
  }
}
