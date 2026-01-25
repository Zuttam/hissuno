import { NextRequest, NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { getSessionById, updateSessionArchiveStatus } from '@/lib/supabase/sessions'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string; sessionId: string }

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
 * PATCH /api/projects/[id]/sessions/[sessionId]/archive
 * Toggles the archive status of a session.
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id: projectId, sessionId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[sessions.archive] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    // First verify the session belongs to this project
    const existingSession = await getSessionById(sessionId)
    if (!existingSession || existingSession.project_id !== projectId) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    const body = await request.json()
    const isArchived = body.is_archived

    if (typeof isArchived !== 'boolean') {
      return NextResponse.json({ error: 'is_archived (boolean) is required.' }, { status: 400 })
    }

    const session = await updateSessionArchiveStatus(sessionId, isArchived)

    if (!session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    return NextResponse.json({ session })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[sessions.archive] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update session.' }, { status: 500 })
  }
}
