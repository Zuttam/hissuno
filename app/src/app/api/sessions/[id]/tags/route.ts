import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { updateSessionTags } from '@/lib/supabase/sessions'
import { getProjectCustomTags } from '@/lib/supabase/custom-tags'
import { SESSION_TAGS } from '@/types/session'

export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * PATCH /api/sessions/[id]/tags
 * Update tags for a session manually.
 * Requires authenticated user who owns the project.
 * Supports both native tags and project-specific custom tags.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    console.error('[sessions.tags] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: sessionId } = await params
    const body = await request.json()

    // Validate tags is an array
    if (!Array.isArray(body.tags)) {
      return NextResponse.json({ error: 'Tags must be an array.' }, { status: 400 })
    }

    // Verify user owns the project
    const supabase = await createClient()
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get session with project
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, project_id, project:projects(user_id)')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    // Check ownership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projectData = session.project as any
    const projectUserId = Array.isArray(projectData) ? projectData[0]?.user_id : projectData?.user_id
    if (!projectUserId || projectUserId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    // Build valid tag set: native tags + project's custom tags
    const validTagSet = new Set<string>(SESSION_TAGS)
    const customTags = await getProjectCustomTags(session.project_id)
    for (const tag of customTags) {
      validTagSet.add(tag.slug)
    }

    // Filter tags to only valid ones
    const tags: string[] = body.tags.filter((t: unknown) =>
      typeof t === 'string' && validTagSet.has(t)
    )

    // Update tags
    const result = await updateSessionTags(sessionId, tags, false)

    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to update tags.' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      tags,
      modifiedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[sessions.tags] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update tags.' }, { status: 500 })
  }
}

/**
 * GET /api/sessions/[id]/tags
 * Get current tags for a session.
 */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    console.error('[sessions.tags] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: sessionId } = await params
    const supabase = await createClient()

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get session with tags
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, tags, tags_auto_applied_at, project:projects(user_id)')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    // Check ownership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const projectData = session.project as any
    const projectUserId = Array.isArray(projectData) ? projectData[0]?.user_id : projectData?.user_id
    if (!projectUserId || projectUserId !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }

    return NextResponse.json({
      tags: session.tags || [],
      autoAppliedAt: session.tags_auto_applied_at,
    })
  } catch (error) {
    console.error('[sessions.tags] unexpected error', error)
    return NextResponse.json({ error: 'Failed to get tags.' }, { status: 500 })
  }
}
