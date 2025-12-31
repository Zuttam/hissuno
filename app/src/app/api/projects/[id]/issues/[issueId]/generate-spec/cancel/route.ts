import { NextResponse } from 'next/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { cancelSpecGeneration } from '@/lib/issues/spec-generation-service'

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
 * POST /api/projects/[id]/issues/[issueId]/generate-spec/cancel
 * Cancel a running spec generation
 */
export async function POST(_request: Request, context: RouteContext) {
  const { id: projectId, issueId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[generate-spec.cancel] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    const result = await cancelSpecGeneration({ issueId, supabase })

    if (!result.success) {
      return NextResponse.json({
        message: result.error,
        cancelled: false,
      })
    }

    console.log('[generate-spec.cancel] Cancelled spec generation for issue:', issueId)

    return NextResponse.json({
      message: 'Spec generation cancelled successfully.',
      cancelled: true,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[generate-spec.cancel] unexpected error', error)
    return NextResponse.json({ error: 'Failed to cancel spec generation.' }, { status: 500 })
  }
}
