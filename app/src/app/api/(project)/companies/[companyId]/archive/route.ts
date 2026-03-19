import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { getCompanyById, updateCompanyArchiveStatus } from '@/lib/db/queries/companies'
import { isDatabaseConfigured } from '@/lib/db/config'

export const runtime = 'nodejs'

type RouteParams = { companyId: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * PATCH /api/companies/[companyId]/archive?projectId=...
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

    const body = await request.json()
    const isArchived = Boolean(body.is_archived)

    const company = await updateCompanyArchiveStatus(companyId, isArchived)
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
    console.error('[companies.archive] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update company.' }, { status: 500 })
  }
}
