import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { listSessions, getProjectIntegrationStats, createManualSession } from '@/lib/supabase/sessions'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import type { SessionFilters, CreateSessionInput, CreateMessageInput, SessionTag } from '@/types/session'

export const runtime = 'nodejs'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * GET /api/projects/[id]/sessions
 * Lists sessions for a specific project.
 *
 * Query params:
 * - stats=true - Returns integration stats instead of sessions list
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[sessions.get] Supabase must be configured to list sessions')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const { searchParams } = new URL(request.url)

    // Stats mode - return integration stats for a project
    if (searchParams.get('stats') === 'true') {
      const stats = await getProjectIntegrationStats(projectId)
      return NextResponse.json({ stats })
    }

    const tagsParam = searchParams.get('tags')
    const filters: SessionFilters = {
      projectId,
      userId: searchParams.get('userId') || undefined,
      sessionId: searchParams.get('sessionId') || undefined,
      name: searchParams.get('name') || undefined,
      status: (searchParams.get('status') as 'active' | 'closed') || undefined,
      source: (searchParams.get('source') as SessionFilters['source']) || undefined,
      tags: tagsParam ? tagsParam.split(',').filter(Boolean) : undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      showArchived: searchParams.get('showArchived') === 'true',
      isHumanTakeover: searchParams.get('isHumanTakeover') === 'true' || undefined,
      isAnalyzed: searchParams.get('isAnalyzed') === 'true' || undefined,
      companyId: searchParams.get('companyId') || undefined,
      contactId: searchParams.get('contactId') || undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 50,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined,
    }

    const { sessions, total } = await listSessions(filters)

    return NextResponse.json({ sessions, total })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[sessions.get] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load sessions.' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/sessions
 * Creates a new manual session for the project.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[sessions.post] Supabase must be configured to create sessions')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = await request.json()

    // Parse and validate tags
    let tags: SessionTag[] | undefined
    if (body.tags && Array.isArray(body.tags)) {
      const validTags = new Set([
        'general_feedback',
        'wins',
        'losses',
        'bug',
        'feature_request',
        'change_request',
      ])
      tags = body.tags.filter((tag: string) => validTags.has(tag)) as SessionTag[]
    }

    // Parse and validate messages
    let messages: CreateMessageInput[] | undefined
    if (body.messages && Array.isArray(body.messages)) {
      messages = body.messages
        .filter(
          (msg: { role?: string; content?: string }) =>
            msg.role &&
            (msg.role === 'user' || msg.role === 'assistant') &&
            msg.content &&
            typeof msg.content === 'string' &&
            msg.content.trim()
        )
        .map((msg: { role: 'user' | 'assistant'; content: string }) => ({
          role: msg.role,
          content: msg.content.trim(),
        }))
    }

    const input: CreateSessionInput = {
      project_id: projectId,
      user_id: body.user_id || undefined,
      user_metadata: body.user_metadata || undefined,
      page_url: body.page_url || undefined,
      page_title: body.page_title || undefined,
      tags,
      messages,
    }

    // Note: Limits are enforced at analysis time (PM review), not at session creation
    const session = await createManualSession(input)

    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[sessions.post] unexpected error', error)
    return NextResponse.json({ error: 'Unable to create session.' }, { status: 500 })
  }
}
