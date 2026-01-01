import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import {
  triggerSpecGeneration,
  getSpecGenerationStatus,
} from '@/lib/issues/spec-generation-service'

export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * Helper to get issue's project_id for authorization
 */
async function getIssueProjectId(issueId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: issue, error } = await supabase
    .from('issues')
    .select('project_id')
    .eq('id', issueId)
    .single()

  if (error || !issue) {
    return null
  }

  return issue.project_id
}

/**
 * GET /api/issues/[id]/generate-spec
 * Get the current status of spec generation for an issue
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: issueId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    // Get project_id from issue for authorization
    const projectId = await getIssueProjectId(issueId, supabase)
    if (!projectId) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

    await assertUserOwnsProject(supabase, user.id, projectId)

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
 * POST /api/issues/[id]/generate-spec
 * Trigger spec generation for an issue (non-blocking, use SSE stream for progress)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: issueId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    // Get project_id from issue for authorization
    const projectId = await getIssueProjectId(issueId, supabase)
    if (!projectId) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

    await assertUserOwnsProject(supabase, user.id, projectId)

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

    return NextResponse.json({
      message: 'Spec generation started.',
      status: 'processing',
      runId: result.runId,
      specRunId: result.specRunId,
    }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[generate-spec] POST error', error)
    return NextResponse.json({ error: 'Failed to start spec generation.' }, { status: 500 })
  }
}
