import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { listCustomFieldDefinitions, createCustomFieldDefinition } from '@/lib/db/queries/customer-custom-fields'
import { isDatabaseConfigured } from '@/lib/db/config'
import { CUSTOM_FIELD_TYPES } from '@/types/customer'
import type { CustomerEntityType } from '@/types/customer'

const VALID_ENTITY_TYPES = ['company', 'contact', 'issue', 'session'] as const

export const runtime = 'nodejs'

/**
 * GET /api/settings/customers/custom-fields?projectId=...
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
    const entityType = (searchParams.get('entity_type') as CustomerEntityType) ?? undefined

    const fields = await listCustomFieldDefinitions(projectId, entityType)
    return NextResponse.json({ fields })
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
    console.error('[custom-fields.list] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load custom fields.' }, { status: 500 })
  }
}

/**
 * POST /api/settings/customers/custom-fields?projectId=...
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

    if (!body.entity_type) {
      return NextResponse.json({ error: 'entity_type is required.' }, { status: 400 })
    }
    if (!body.field_key) {
      return NextResponse.json({ error: 'field_key is required.' }, { status: 400 })
    }
    if (!/^[a-z][a-z0-9_]{0,49}$/.test(body.field_key)) {
      return NextResponse.json({ error: 'field_key must start with a lowercase letter and contain only lowercase letters, digits, and underscores (max 50 characters).' }, { status: 400 })
    }
    if (!body.field_label) {
      return NextResponse.json({ error: 'field_label is required.' }, { status: 400 })
    }
    if (!body.field_type) {
      return NextResponse.json({ error: 'field_type is required.' }, { status: 400 })
    }
    if (!(VALID_ENTITY_TYPES as readonly string[]).includes(body.entity_type)) {
      return NextResponse.json({ error: `Invalid entity_type. Must be one of: ${VALID_ENTITY_TYPES.join(', ')}` }, { status: 400 })
    }
    if (!(CUSTOM_FIELD_TYPES as readonly string[]).includes(body.field_type)) {
      return NextResponse.json({ error: `Invalid field_type. Must be one of: ${CUSTOM_FIELD_TYPES.join(', ')}` }, { status: 400 })
    }

    const field = await createCustomFieldDefinition({
      projectId,
      entityType: body.entity_type,
      fieldKey: body.field_key,
      fieldLabel: body.field_label,
      fieldType: body.field_type,
      selectOptions: body.select_options ?? undefined,
      position: body.position ?? 0,
      isRequired: body.is_required ?? false,
    })

    return NextResponse.json({ field }, { status: 201 })
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
    if (error instanceof Error && error.message.includes('Maximum')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('[custom-fields.post] unexpected error', error)
    return NextResponse.json({ error: 'Unable to create custom field.' }, { status: 500 })
  }
}
