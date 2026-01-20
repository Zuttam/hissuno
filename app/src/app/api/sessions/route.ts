import { NextRequest, NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { listSessions, getProjectIntegrationStats, createManualSession } from '@/lib/supabase/sessions'
import { isSupabaseConfigured, createClient } from '@/lib/supabase/server'
import type { SessionFilters, CreateSessionInput, CreateMessageInput, SessionTag } from '@/types/session'

export const runtime = 'nodejs'

/**
 * GET /api/sessions
 * Lists sessions with optional filters. Only returns sessions for projects owned by the authenticated user.
 *
 * Query params:
 * - stats=true&projectId={id} - Returns integration stats instead of sessions list
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[sessions.get] Supabase must be configured to list sessions')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(request.url)

    // Stats mode - return integration stats for a project
    if (searchParams.get('stats') === 'true') {
      const projectId = searchParams.get('projectId')
      if (!projectId) {
        return NextResponse.json({ error: 'projectId required for stats' }, { status: 400 })
      }
      const stats = await getProjectIntegrationStats(projectId)
      return NextResponse.json({ stats })
    }

    const tagsParam = searchParams.get('tags')
    const filters: SessionFilters = {
      projectId: searchParams.get('projectId') || undefined,
      userId: searchParams.get('userId') || undefined,
      sessionId: searchParams.get('sessionId') || undefined,
      name: searchParams.get('name') || undefined,
      status: (searchParams.get('status') as 'active' | 'closed') || undefined,
      source: (searchParams.get('source') as SessionFilters['source']) || undefined,
      tags: tagsParam ? tagsParam.split(',').filter(Boolean) : undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      showArchived: searchParams.get('showArchived') === 'true',
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined,
    }

    const sessions = await listSessions(filters)

    return NextResponse.json({ sessions })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[sessions.get] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load sessions.' }, { status: 500 })
  }
}

/**
 * POST /api/sessions
 * Creates a new manual session.
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[sessions.post] Supabase must be configured to create sessions')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()

    // Parse and validate tags
    let tags: SessionTag[] | undefined
    if (body.tags && Array.isArray(body.tags)) {
      const validTags = new Set(['general_feedback', 'wins', 'losses', 'bug', 'feature_request', 'change_request'])
      tags = body.tags.filter((tag: string) => validTags.has(tag)) as SessionTag[]
    }

    // Parse and validate messages
    let messages: CreateMessageInput[] | undefined
    if (body.messages && Array.isArray(body.messages)) {
      messages = body.messages
        .filter((msg: { role?: string; content?: string }) =>
          msg.role && (msg.role === 'user' || msg.role === 'assistant') &&
          msg.content && typeof msg.content === 'string' && msg.content.trim()
        )
        .map((msg: { role: 'user' | 'assistant'; content: string }) => ({
          role: msg.role,
          content: msg.content.trim(),
        }))
    }

    const input: CreateSessionInput = {
      project_id: body.project_id,
      user_id: body.user_id || undefined,
      page_url: body.page_url || undefined,
      page_title: body.page_title || undefined,
      tags,
      messages,
    }

    if (!input.project_id) {
      return NextResponse.json({ error: 'project_id is required.' }, { status: 400 })
    }

    // Note: Limits are enforced at analysis time (PM review), not at session creation
    const session = await createManualSession(input)

    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[sessions.post] unexpected error', error)
    return NextResponse.json({ error: 'Unable to create session.' }, { status: 500 })
  }
}
