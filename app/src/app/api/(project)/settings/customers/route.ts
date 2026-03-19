import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { listCustomFieldDefinitions } from '@/lib/db/queries/customer-custom-fields'
import { isDatabaseConfigured } from '@/lib/db/config'

export const runtime = 'nodejs'

/**
 * GET /api/settings/customers?projectId=...
 *
 * Unified customer settings endpoint.
 * Returns custom field definitions grouped by entity type.
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const fields = await listCustomFieldDefinitions(projectId)

    const company = fields.filter((f) => f.entity_type === 'company')
    const contact = fields.filter((f) => f.entity_type === 'contact')

    return NextResponse.json({ customFields: { company, contact } })
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
    console.error('[settings.customers.get] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load customer settings.' }, { status: 500 })
  }
}
