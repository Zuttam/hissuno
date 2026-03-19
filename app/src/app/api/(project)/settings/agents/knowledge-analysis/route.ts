import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import {
  getKnowledgeAnalysisSettings,
  updateKnowledgeAnalysisSettings,
} from '@/lib/db/queries/project-settings/knowledge-analysis'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'

export const runtime = 'nodejs'

/**
 * GET /api/settings/agents/knowledge-analysis?projectId=...
 * Get knowledge analysis settings for a project
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const settings = await getKnowledgeAnalysisSettings(projectId)
    return NextResponse.json({ settings })
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

    console.error('[settings.workflows.knowledge-analysis.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load settings.' }, { status: 500 })
  }
}

/**
 * PATCH /api/settings/agents/knowledge-analysis?projectId=...
 * Update knowledge analysis settings for a project
 */
export async function PATCH(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = await request.json()
    const { knowledge_relationship_guidelines } = body as {
      knowledge_relationship_guidelines?: string | null
    }

    const settings = await updateKnowledgeAnalysisSettings(projectId, {
      knowledge_relationship_guidelines,
    })

    return NextResponse.json({ settings })
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

    console.error('[settings.workflows.knowledge-analysis.patch] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update settings.' }, { status: 500 })
  }
}
