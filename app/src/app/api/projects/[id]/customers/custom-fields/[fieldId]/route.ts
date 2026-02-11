import { NextRequest, NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { updateCustomFieldDefinition, deleteCustomFieldDefinition } from '@/lib/supabase/customer-custom-fields'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import type { UpdateCustomFieldInput } from '@/types/customer'

export const runtime = 'nodejs'

type RouteParams = { id: string; fieldId: string }
type RouteContext = { params: Promise<RouteParams> }

async function resolveUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new UnauthorizedError('User not authenticated')
  }

  return { supabase, user }
}

/**
 * PATCH /api/projects/[id]/customers/custom-fields/[fieldId]
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  const { id: projectId, fieldId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()
    await assertUserOwnsProject(supabase, user.id, projectId)

    const body = (await request.json()) as UpdateCustomFieldInput
    const field = await updateCustomFieldDefinition(supabase, fieldId, body, projectId)

    return NextResponse.json({ field })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
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
    const { supabase, user } = await resolveUser()
    await assertUserOwnsProject(supabase, user.id, projectId)

    await deleteCustomFieldDefinition(supabase, fieldId, projectId)
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[custom-fields.delete] unexpected error', error)
    return NextResponse.json({ error: 'Unable to delete custom field.' }, { status: 500 })
  }
}
