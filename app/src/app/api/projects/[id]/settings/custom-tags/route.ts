import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { listProjectCustomTags } from '@/lib/supabase/custom-tags'

export const runtime = 'nodejs'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * GET /api/projects/[id]/settings/custom-tags
 *
 * List all custom tags for a project.
 *
 * Note: Tag creation, updates, and deletion are handled via
 * PATCH /api/projects/[id]/settings/sessions with the custom_tags field.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[custom-tags.get] Supabase must be configured', projectId)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const tags = await listProjectCustomTags(projectId)
    return NextResponse.json({ tags })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[custom-tags.get] unexpected error', projectId, error)
    return NextResponse.json({ error: 'Failed to load custom tags.' }, { status: 500 })
  }
}
