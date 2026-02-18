import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError, getClientForIdentity } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * POST /api/projects/[id]/rotate-keys
 *
 * Rotate project secret key.
 * Body: { keyType: 'secret' }
 */
export async function POST(request: Request, context: RouteContext) {
  const { id } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[projects.rotate-keys] Supabase must be configured', id)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  const payload = await request.json().catch(() => null)

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  // Only support 'secret' key rotation now
  const keyType = payload.keyType as string | undefined
  if (keyType !== 'secret') {
    return NextResponse.json(
      { error: 'Invalid keyType. Must be "secret".' },
      { status: 400 }
    )
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, id, { requiredRole: 'owner' })
    const supabase = await getClientForIdentity(identity)

    // Generate new secret key
    const { data: newSecretKey, error: secError } = await supabase.rpc('generate_project_key', {
      prefix: 'sk_',
      random_length: 48,
    })

    if (secError) {
      console.error('[projects.rotate-keys] failed to generate secret key', id, secError)
      return NextResponse.json({ error: 'Failed to generate new secret key.' }, { status: 500 })
    }

    // Update the project with new key
    const { error: updateError } = await supabase
      .from('projects')
      .update({ secret_key: newSecretKey })
      .eq('id', id)

    if (updateError) {
      console.error('[projects.rotate-keys] failed to update project', id, updateError)
      return NextResponse.json({ error: 'Failed to update project key.' }, { status: 500 })
    }

    // Fetch the updated project
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('*, source_code:source_codes(*)')
      .eq('id', id)
      .single()

    if (fetchError) {
      console.error('[projects.rotate-keys] failed to fetch updated project', id, fetchError)
      return NextResponse.json({ error: 'Key rotated but failed to fetch updated project.' }, { status: 500 })
    }

    return NextResponse.json({
      project,
      rotated: 'secret',
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[projects.rotate-keys] unexpected error', id, error)
    return NextResponse.json({ error: 'Failed to rotate key.' }, { status: 500 })
  }
}
