import { NextResponse } from 'next/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

type KeyType = 'public' | 'secret' | 'both'

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
 * Rotate project API keys (public, secret, or both).
 * Body: { keyType: 'public' | 'secret' | 'both' }
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

  const keyType = payload.keyType as KeyType | undefined
  if (!keyType || !['public', 'secret', 'both'].includes(keyType)) {
    return NextResponse.json(
      { error: 'Invalid keyType. Must be "public", "secret", or "both".' },
      { status: 400 }
    )
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, id)

    const updates: { public_key?: string; secret_key?: string } = {}

    // Generate new public key if requested
    if (keyType === 'public' || keyType === 'both') {
      const { data: newPublicKey, error: pubError } = await supabase.rpc('generate_project_key', {
        prefix: 'pk_',
        random_length: 32,
      })

      if (pubError) {
        console.error('[projects.rotate-keys] failed to generate public key', id, pubError)
        return NextResponse.json({ error: 'Failed to generate new public key.' }, { status: 500 })
      }

      updates.public_key = newPublicKey
    }

    // Generate new secret key if requested
    if (keyType === 'secret' || keyType === 'both') {
      const { data: newSecretKey, error: secError } = await supabase.rpc('generate_project_key', {
        prefix: 'sk_',
        random_length: 48,
      })

      if (secError) {
        console.error('[projects.rotate-keys] failed to generate secret key', id, secError)
        return NextResponse.json({ error: 'Failed to generate new secret key.' }, { status: 500 })
      }

      updates.secret_key = newSecretKey
    }

    // Update the project with new key(s)
    const { error: updateError } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', id)
      .eq('user_id', user.id)

    if (updateError) {
      console.error('[projects.rotate-keys] failed to update project', id, updateError)
      return NextResponse.json({ error: 'Failed to update project keys.' }, { status: 500 })
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
      return NextResponse.json({ error: 'Keys rotated but failed to fetch updated project.' }, { status: 500 })
    }

    return NextResponse.json({
      project,
      rotated: keyType,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[projects.rotate-keys] unexpected error', id, error)
    return NextResponse.json({ error: 'Failed to rotate keys.' }, { status: 500 })
  }
}
