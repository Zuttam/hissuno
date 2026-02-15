import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { listCompanies, insertCompany } from '@/lib/supabase/companies'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { COMPANY_STAGES } from '@/types/customer'
import type { CompanyStage } from '@/types/customer'

export const runtime = 'nodejs'

type RouteParams = { id: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * GET /api/projects/[id]/customers/companies
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const { searchParams } = new URL(request.url)

    const filters = {
      projectId,
      stage: (searchParams.get('stage') as CompanyStage) ?? undefined,
      search: searchParams.get('search') ?? undefined,
      industry: searchParams.get('industry') ?? undefined,
      planTier: searchParams.get('planTier') ?? undefined,
      country: searchParams.get('country') ?? undefined,
      showArchived: searchParams.get('showArchived') === 'true',
      limit: searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : undefined,
      offset: searchParams.get('offset') ? parseInt(searchParams.get('offset')!, 10) : undefined,
    }

    const { companies, total } = await listCompanies(filters)
    return NextResponse.json({ companies, total })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[companies.list] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load companies.' }, { status: 500 })
  }
}

/**
 * POST /api/projects/[id]/customers/companies
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await createClient()

    const body = await request.json()

    if (!body.name) {
      return NextResponse.json({ error: 'name is required.' }, { status: 400 })
    }
    if (!body.domain) {
      return NextResponse.json({ error: 'domain is required.' }, { status: 400 })
    }
    if (body.stage && !(COMPANY_STAGES as readonly string[]).includes(body.stage)) {
      return NextResponse.json({ error: `Invalid stage. Must be one of: ${COMPANY_STAGES.join(', ')}` }, { status: 400 })
    }

    const company = await insertCompany(supabase, {
      projectId,
      name: body.name,
      domain: body.domain,
      arr: body.arr ?? null,
      stage: body.stage ?? 'prospect',
      productUsed: body.product_used ?? null,
      industry: body.industry ?? null,
      employeeCount: body.employee_count ?? null,
      planTier: body.plan_tier ?? null,
      renewalDate: body.renewal_date ?? null,
      healthScore: body.health_score ?? null,
      country: body.country ?? null,
      notes: body.notes ?? null,
      customFields: body.custom_fields ?? {},
    })

    return NextResponse.json({ company }, { status: 201 })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[companies.post] unexpected error', error)
    return NextResponse.json({ error: 'Unable to create company.' }, { status: 500 })
  }
}
