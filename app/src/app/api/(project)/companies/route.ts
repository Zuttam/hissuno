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
import { upsertExternalRecord } from '@/lib/db/queries/external-records'

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

type CompanyItemInput = {
  name?: string
  domain?: string
  arr?: number | null
  stage?: string
  product_used?: string | null
  industry?: string | null
  employee_count?: number | null
  plan_tier?: string | null
  renewal_date?: string | null
  health_score?: number | null
  country?: string | null
  notes?: string | null
  custom_fields?: Record<string, unknown>
  external_id?: string
  external_source?: string
}

function validateCompany(item: CompanyItemInput): string | null {
  if (!item.name) return 'name is required.'
  if (!item.domain) return 'domain is required.'
  if (item.stage && !(COMPANY_STAGES as readonly string[]).includes(item.stage)) {
    return `Invalid stage. Must be one of: ${COMPANY_STAGES.join(', ')}`
  }
  return null
}

async function createCompanyFromItem(projectId: string, item: CompanyItemInput) {
  const error = validateCompany(item)
  if (error) throw new Error(error)

  const company = await createCompany({
    projectId,
    name: item.name!,
    domain: item.domain!,
    arr: item.arr ?? null,
    stage: (item.stage as CompanyStage | undefined) ?? 'prospect',
    productUsed: item.product_used ?? null,
    industry: item.industry ?? null,
    employeeCount: item.employee_count ?? null,
    planTier: item.plan_tier ?? null,
    renewalDate: item.renewal_date ?? null,
    healthScore: item.health_score ?? null,
    country: item.country ?? null,
    notes: item.notes ?? null,
    customFields: item.custom_fields ?? {},
  })

  if (item.external_id && item.external_source && company?.id) {
    await upsertExternalRecord({
      projectId,
      source: item.external_source,
      externalId: item.external_id,
      resourceType: 'company',
      resourceId: company.id,
    })
  }

  return company
}

/**
 * POST /api/companies?projectId=...
 *
 * Body shapes:
 *   - Single:  { name, domain, ... }
 *   - Batch:   { items: [{ name, domain, ... }, ...] }
 *
 * Each item may include `external_id` + `external_source` to register an
 * external→hissuno mapping in `external_records` after the company is created.
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = (await request.json()) as CompanyItemInput & { items?: CompanyItemInput[] }

    if (Array.isArray(body.items)) {
      const created: unknown[] = []
      const errors: { index: number; error: string }[] = []
      for (let i = 0; i < body.items.length; i++) {
        try {
          const company = await createCompanyFromItem(projectId, body.items[i])
          created.push(company)
        } catch (err) {
          errors.push({ index: i, error: err instanceof Error ? err.message : String(err) })
        }
      }
      return NextResponse.json({ created, errors }, { status: errors.length === 0 ? 201 : 207 })
    }

    const validationError = validateCompany(body)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }
    const company = await createCompanyFromItem(projectId, body)
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
