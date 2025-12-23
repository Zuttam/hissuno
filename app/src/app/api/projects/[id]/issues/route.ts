import { NextRequest, NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { getProjectIssues } from '@/lib/supabase/issues'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * GET /api/projects/[id]/issues
 * Lists issues for a specific project.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    console.error('[projects.issues] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: projectId } = await params
    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') ?? '50', 10)

    const issues = await getProjectIssues(projectId, limit)

    return NextResponse.json({ issues })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[projects.issues] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load issues.' }, { status: 500 })
  }
}
