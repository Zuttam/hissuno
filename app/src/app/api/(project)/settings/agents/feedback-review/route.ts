import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import {
  getPmAgentSettings,
  updatePmAgentSettings,
} from '@/lib/db/queries/project-settings/workflow-guidelines'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'

export const runtime = 'nodejs'

/**
 * GET /api/settings/agents/feedback-review?projectId=...
 * Get feedback review workflow settings (classification + analysis guidelines)
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const all = await getPmAgentSettings(projectId)
    return NextResponse.json({
      settings: {
        classification_guidelines: all.classification_guidelines,
        analysis_guidelines: all.analysis_guidelines,
        issue_tracking_enabled: all.issue_tracking_enabled,
      },
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

    console.error('[settings.workflows.feedback-review.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load settings.' }, { status: 500 })
  }
}

/**
 * PATCH /api/settings/agents/feedback-review?projectId=...
 * Update feedback review workflow settings
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
    const { classification_guidelines, analysis_guidelines, issue_tracking_enabled } = body as {
      classification_guidelines?: string | null
      analysis_guidelines?: string | null
      issue_tracking_enabled?: boolean
    }

    const all = await updatePmAgentSettings(projectId, {
      classification_guidelines,
      analysis_guidelines,
      issue_tracking_enabled,
    })

    return NextResponse.json({
      settings: {
        classification_guidelines: all.classification_guidelines,
        analysis_guidelines: all.analysis_guidelines,
        issue_tracking_enabled: all.issue_tracking_enabled,
      },
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

    console.error('[settings.workflows.feedback-review.patch] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update settings.' }, { status: 500 })
  }
}
