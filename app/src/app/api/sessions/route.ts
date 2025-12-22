import { NextRequest, NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { listSessions } from '@/lib/supabase/sessions'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import type { SessionFilters } from '@/types/session'

export const runtime = 'nodejs'

/**
 * GET /api/sessions
 * Lists sessions with optional filters. Only returns sessions for projects owned by the authenticated user.
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[sessions.get] Supabase must be configured to list sessions')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(request.url)

    const filters: SessionFilters = {
      projectId: searchParams.get('projectId') || undefined,
      userId: searchParams.get('userId') || undefined,
      sessionId: searchParams.get('sessionId') || undefined,
      status: (searchParams.get('status') as 'active' | 'closed') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
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
