import { NextResponse } from 'next/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

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
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, id)

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
      .eq('user_id', user.id)

    if (updateError) {
      console.error('[projects.rotate-keys] failed to update project', id, updateError)
      return NextResponse.json({ error: 'Failed to update project key.' }, { status: 500 })
    }

    // Fetch the updated project
    const { data: project, error: fetchError } = await supabase
      .from('projects')
      .select('*, source_code:source_codes(*)')
      .eq('id', id)
      .eq('user_id', user.id)
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
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[projects.rotate-keys] unexpected error', id, error)
    return NextResponse.json({ error: 'Failed to rotate key.' }, { status: 500 })
  }
}
