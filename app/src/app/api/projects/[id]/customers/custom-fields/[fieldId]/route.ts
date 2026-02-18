import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError, getClientForIdentity } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { updateCustomFieldDefinition, deleteCustomFieldDefinition } from '@/lib/supabase/customer-custom-fields'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import type { UpdateCustomFieldInput } from '@/types/customer'

export const runtime = 'nodejs'

type RouteParams = { id: string; fieldId: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * PATCH /api/projects/[id]/customers/custom-fields/[fieldId]
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id: projectId, fieldId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await getClientForIdentity(identity)

    const body = (await request.json()) as UpdateCustomFieldInput
    const field = await updateCustomFieldDefinition(supabase, fieldId, body, projectId)

    return NextResponse.json({ field })
  } catch (error) {
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
 * DELETE /api/projects/[id]/customers/custom-fields/[fieldId]
 */
export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { id: projectId, fieldId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await getClientForIdentity(identity)

    await deleteCustomFieldDefinition(supabase, fieldId, projectId)
    return NextResponse.json({ success: true })
  } catch (error) {
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
