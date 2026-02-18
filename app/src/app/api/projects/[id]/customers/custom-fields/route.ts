import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError, getClientForIdentity } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { listCustomFieldDefinitions, createCustomFieldDefinition } from '@/lib/supabase/customer-custom-fields'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { CUSTOM_FIELD_TYPES } from '@/types/customer'
import type { CustomerEntityType } from '@/types/customer'

const VALID_ENTITY_TYPES = ['company', 'contact'] as const

export const runtime = 'nodejs'

type RouteParams = { id: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * GET /api/projects/[id]/customers/custom-fields
 */
export async function GET(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await getClientForIdentity(identity)

    const { searchParams } = new URL(request.url)
    const entityType = (searchParams.get('entity_type') as CustomerEntityType) ?? undefined

    const fields = await listCustomFieldDefinitions(supabase, projectId, entityType)
    return NextResponse.json({ fields })
  } catch (error) {
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
 * POST /api/projects/[id]/customers/custom-fields
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await getClientForIdentity(identity)

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

    const field = await createCustomFieldDefinition(supabase, {
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
