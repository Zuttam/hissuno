import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { listCompanies } from '@/lib/db/queries/companies'
import { createCompany } from '@/lib/customers/customers-service'
import { isDatabaseConfigured } from '@/lib/db/config'
import { COMPANY_STAGES } from '@/types/customer'
import type { CompanyStage } from '@/types/customer'

export const runtime = 'nodejs'

/**
 * GET /api/companies?projectId=...
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
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

    const { companies, total } = await listCompanies(projectId, filters)
    return NextResponse.json({ companies, total })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
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
 * POST /api/companies?projectId=...
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

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

    const company = await createCompany({
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
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
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
