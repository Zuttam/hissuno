import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { getCompanyById, updateCompanyArchiveStatus } from '@/lib/supabase/companies'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string; companyId: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * PATCH /api/projects/[id]/customers/companies/[companyId]/archive
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id: projectId, companyId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await createClient()

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
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[companies.archive] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update company.' }, { status: 500 })
  }
}
