import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { updateCustomFieldDefinition, deleteCustomFieldDefinition } from '@/lib/db/queries/customer-custom-fields'
import { isDatabaseConfigured } from '@/lib/db/config'
import type { UpdateCustomFieldInput } from '@/types/customer'

export const runtime = 'nodejs'

type RouteParams = { fieldId: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * PATCH /api/settings/customers/custom-fields/[fieldId]?projectId=...
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { fieldId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = (await request.json()) as UpdateCustomFieldInput
    const field = await updateCustomFieldDefinition(fieldId, body, projectId)

    return NextResponse.json({ field })
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
    console.error('[custom-fields.update] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update custom field.' }, { status: 500 })
  }
}

/**
 * DELETE /api/settings/customers/custom-fields/[fieldId]?projectId=...
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const { fieldId } = await context.params

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    await deleteCustomFieldDefinition(fieldId, projectId)
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
    console.error('[custom-fields.delete] unexpected error', error)
    return NextResponse.json({ error: 'Unable to delete custom field.' }, { status: 500 })
  }
}
