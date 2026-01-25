import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { getIssueById } from '@/lib/supabase/issues'
import {
  triggerSpecGeneration,
  getSpecGenerationStatus,
} from '@/lib/issues/spec-generation-service'

export const runtime = 'nodejs'

type RouteParams = { id: string; issueId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

async function resolveUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new UnauthorizedError('User not authenticated')
  }

  return { supabase, user }
}

/**
 * GET /api/projects/[id]/issues/[issueId]/generate-spec
 * Get the current status of spec generation for an issue
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: projectId, issueId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    // Verify the issue belongs to this project
    const existingIssue = await getIssueById(issueId)
    if (!existingIssue || existingIssue.project_id !== projectId) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

    const status = await getSpecGenerationStatus({ issueId, supabase })

    return NextResponse.json(status)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[generate-spec] GET error', error)
    return NextResponse.json({ error: 'Failed to get status.' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/issues/[issueId]/generate-spec
 * Trigger spec generation for an issue (non-blocking, use SSE stream for progress)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id: projectId, issueId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    // Verify the issue belongs to this project
    const existingIssue = await getIssueById(issueId)
    if (!existingIssue || existingIssue.project_id !== projectId) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

    // Check for regenerate flag in request body
    let regenerate = false
    try {
      const body = await request.json()
      regenerate = body?.regenerate === true
    } catch {
      // No body or invalid JSON - default to false
    }

    const result = await triggerSpecGeneration({
      projectId,
      issueId,
      supabase,
      regenerate,
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, runId: result.runId, specRunId: result.specRunId },
        { status: result.statusCode }
      )
    }

    return NextResponse.json(
      {
        message: 'Spec generation started.',
        status: 'processing',
        runId: result.runId,
        specRunId: result.specRunId,
      },
      { status: 201 }
    )
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[generate-spec] POST error', error)
    return NextResponse.json({ error: 'Failed to start spec generation.' }, { status: 500 })
  }
}
