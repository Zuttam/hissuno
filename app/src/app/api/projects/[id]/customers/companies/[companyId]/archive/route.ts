import { NextRequest, NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { getCompanyById, updateCompanyArchiveStatus } from '@/lib/supabase/companies'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string; companyId: string }
type RouteContext = { params: Promise<RouteParams> }

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
 * PATCH /api/projects/[id]/customers/companies/[companyId]/archive
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id: projectId, companyId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()
    await assertUserOwnsProject(supabase, user.id, projectId)

    const existing = await getCompanyById(companyId)
    if (!existing || existing.project_id !== projectId) {
      return NextResponse.json({ error: 'Company not found.' }, { status: 404 })
    }

    const body = await request.json()
    const isArchived = Boolean(body.is_archived)

    const company = await updateCompanyArchiveStatus(supabase, companyId, isArchived)
    return NextResponse.json({ company })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[companies.archive] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update company.' }, { status: 500 })
  }
}
