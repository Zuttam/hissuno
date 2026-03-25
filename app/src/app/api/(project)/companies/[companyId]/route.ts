import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { getCompanyById, updateCompanyById, deleteCompanyById } from '@/lib/db/queries/companies'
import { fireGraphEval } from '@/lib/utils/graph-eval'
import { isDatabaseConfigured } from '@/lib/db/config'
import { COMPANY_STAGES } from '@/types/customer'
import type { UpdateCompanyInput } from '@/types/customer'

export const runtime = 'nodejs'

type RouteParams = { companyId: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * GET /api/companies/[companyId]?projectId=...
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { companyId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const company = await getCompanyById(companyId)

    if (!company || company.project_id !== projectId) {
      return NextResponse.json({ error: 'Company not found.' }, { status: 404 })
    }

    return NextResponse.json({ company })
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
    console.error('[companies.get] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load company.' }, { status: 500 })
  }
}

/**
 * PATCH /api/companies/[companyId]?projectId=...
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { companyId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

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

    const company = await updateCompanyById(companyId, body)
    fireGraphEval(projectId, 'company', company.id)

    // Fire-and-forget embedding update
    void (async () => {
      try {
        const { fireEmbedding } = await import('@/lib/utils/embeddings')
        const { buildCompanyEmbeddingText } = await import('@/lib/customers/customer-embedding-service')
        fireEmbedding(companyId, 'company', projectId, buildCompanyEmbeddingText(company))
      } catch {}
    })()

    return NextResponse.json({ company })
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
    console.error('[companies.update] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update company.' }, { status: 500 })
  }
}

/**
 * DELETE /api/companies/[companyId]?projectId=...
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { companyId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const existing = await getCompanyById(companyId)
    if (!existing || existing.project_id !== projectId) {
      return NextResponse.json({ error: 'Company not found.' }, { status: 404 })
    }

    await deleteCompanyById(companyId)
    return NextResponse.json({ success: true })
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
    console.error('[companies.delete] unexpected error', error)
    return NextResponse.json({ error: 'Unable to delete company.' }, { status: 500 })
  }
}
