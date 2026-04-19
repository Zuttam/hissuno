import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import {
  getGraphEvaluationSettings,
  setGraphEvaluationSettings,
} from '@/lib/db/queries/graph-evaluation-settings'
import { mergeAndValidateConfig } from '@/mastra/workflows/graph-evaluation/config'
import { ZodError } from 'zod'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const config = await getGraphEvaluationSettings(projectId)
    return NextResponse.json({ config })
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
    const current = await getGraphEvaluationSettings(projectId)
    const next = mergeAndValidateConfig(current, body)
    const saved = await setGraphEvaluationSettings(projectId, next)

    return NextResponse.json({ config: saved })
  } catch (error) {
    if (error instanceof MissingProjectIdError) return NextResponse.json({ error: error.message }, { status: 400 })
    if (error instanceof UnauthorizedError) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    if (error instanceof ForbiddenError) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    if (error instanceof ZodError) return NextResponse.json({ error: 'Invalid config', details: error.issues }, { status: 400 })
    console.error('[settings.graph-evaluation] PATCH error', error)
    return NextResponse.json({ error: 'Failed to update graph evaluation settings.' }, { status: 500 })
  }
}
