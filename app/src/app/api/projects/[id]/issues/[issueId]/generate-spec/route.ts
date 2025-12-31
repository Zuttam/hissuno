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
  params: Promise<{ id: string; issueId: string }>
}

/**
 * GET /api/projects/[id]/issues/[issueId]/generate-spec
 * Get the current status of spec generation for an issue
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: projectId, issueId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
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
 * POST /api/projects/[id]/issues/[issueId]/generate-spec
 * Trigger spec generation for an issue (non-blocking, use SSE stream for progress)
 */
export async function POST(_request: NextRequest, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: projectId, issueId } = await params
    const supabase = await createClient()

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    await assertUserOwnsProject(supabase, user.id, projectId)

    const result = await triggerSpecGeneration({
      projectId,
      issueId,
      supabase,
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
