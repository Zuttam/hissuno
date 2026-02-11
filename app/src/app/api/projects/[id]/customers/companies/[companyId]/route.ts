import { NextRequest, NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { getCompanyById, updateCompanyById, deleteCompanyById } from '@/lib/supabase/companies'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { COMPANY_STAGES } from '@/types/customer'
import type { UpdateCompanyInput } from '@/types/customer'

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
 * GET /api/projects/[id]/customers/companies/[companyId]
 */
export async function GET(_request: NextRequest, context: RouteContext) {
  const { id: projectId, companyId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()
    await assertUserOwnsProject(supabase, user.id, projectId)

    const company = await getCompanyById(companyId)

    if (!company || company.project_id !== projectId) {
      return NextResponse.json({ error: 'Company not found.' }, { status: 404 })
    }

    return NextResponse.json({ company })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[companies.get] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load company.' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[id]/customers/companies/[companyId]
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

    const body = (await request.json()) as UpdateCompanyInput

    if (body.stage !== undefined && !(COMPANY_STAGES as readonly string[]).includes(body.stage)) {
      return NextResponse.json({ error: `Invalid stage. Must be one of: ${COMPANY_STAGES.join(', ')}` }, { status: 400 })
    }
    if (body.health_score !== undefined && body.health_score !== null) {
      if (typeof body.health_score !== 'number' || body.health_score < 0 || body.health_score > 100) {
        return NextResponse.json({ error: 'health_score must be a number between 0 and 100.' }, { status: 400 })
      }
    }

    const company = await updateCompanyById(supabase, companyId, body)

    return NextResponse.json({ company })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[companies.update] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update company.' }, { status: 500 })
  }
}

/**
 * DELETE /api/projects/[id]/customers/companies/[companyId]
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
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

    await deleteCompanyById(supabase, companyId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[companies.delete] unexpected error', error)
    return NextResponse.json({ error: 'Unable to delete company.' }, { status: 500 })
  }
}
