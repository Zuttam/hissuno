import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * GET /api/projects/[id]/keys
 *
 * Returns the project's secret key for display in the edit form.
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[projects.keys] Supabase must be configured', id)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, id, { requiredRole: 'owner' })
    const supabase = await createClient()

    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('secret_key')
      .eq('id', id)
      .single()

    if (fetchError || !project) {
      console.error('[projects.keys] failed to fetch project', id, fetchError)
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    return NextResponse.json({ secretKey: project.secret_key })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[projects.keys] unexpected error', id, error)
    return NextResponse.json({ error: 'Failed to fetch keys.' }, { status: 500 })
  }
}
