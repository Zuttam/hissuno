import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured, createAdminClient } from '@/lib/supabase/server'
import { validateBatchIds, BatchValidationError } from '@/lib/batch/validation'

export const runtime = 'nodejs'

type RouteParams = { id: string }
type RouteContext = { params: Promise<RouteParams> }

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * POST /api/projects/[id]/sessions/batch/set-customer
 * Batch assign or remove a contact from sessions.
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = await request.json()
    const { sessionIds, contactId } = body

    console.log('[sessions.batch.set-customer] request', {
      projectId,
      contactId,
      sessionIds,
      sessionIdsType: typeof sessionIds,
      sessionIdsIsArray: Array.isArray(sessionIds),
      sessionIdsLength: Array.isArray(sessionIds) ? sessionIds.length : 'N/A',
    })

    // contactId can be null (remove contact) or a valid UUID
    if (contactId !== null) {
      if (typeof contactId !== 'string' || !UUID_REGEX.test(contactId)) {
        return NextResponse.json({ error: 'Invalid contact ID.' }, { status: 400 })
      }

      // Verify contact belongs to the same project
      const supabase = createAdminClient()
      const { data: contact } = await supabase
        .from('contacts')
        .select('id, project_id')
        .eq('id', contactId)
        .single()

      if (!contact || contact.project_id !== projectId) {
        return NextResponse.json({ error: 'Contact not found.' }, { status: 400 })
      }
    }

    const validatedIds = await validateBatchIds({
      projectId,
      table: 'sessions',
      ids: sessionIds,
      maxSize: 100,
    })

    const supabase = createAdminClient()
    const { error } = await supabase
      .from('sessions')
      .update({ contact_id: contactId })
      .in('id', validatedIds)
      .eq('project_id', projectId)

    if (error) {
      console.error('[sessions.batch.set-customer] update error', error)
      return NextResponse.json({ error: 'Failed to update sessions.' }, { status: 500 })
    }

    return NextResponse.json({ success: true, count: validatedIds.length })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    if (error instanceof BatchValidationError) {
      console.error('[sessions.batch.set-customer] validation failed', error.message)
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    console.error('[sessions.batch.set-customer] unexpected error', error)
    return NextResponse.json({ error: 'Unable to update sessions.' }, { status: 500 })
  }
}
