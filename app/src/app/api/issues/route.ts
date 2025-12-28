import { NextRequest, NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { listIssues } from '@/lib/supabase/issues'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import type { IssueType, IssuePriority, IssueStatus } from '@/types/issue'

export const runtime = 'nodejs'

/**
 * GET /api/issues
 * Lists issues across all projects owned by the current user.
 * Supports filtering by project, type, priority, status, and search.
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[issues.list] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(request.url)

    const filters = {
      projectId: searchParams.get('projectId') ?? undefined,
      type: (searchParams.get('type') as IssueType) ?? undefined,
      priority: (searchParams.get('priority') as IssuePriority) ?? undefined,
      status: (searchParams.get('status') as IssueStatus) ?? undefined,
      search: searchParams.get('search') ?? undefined,
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined,
    }

    const issues = await listIssues(filters)

    return NextResponse.json({ issues })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[issues.list] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load issues.' }, { status: 500 })
  }
}
