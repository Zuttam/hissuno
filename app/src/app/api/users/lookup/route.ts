import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { UnauthorizedError } from '@/lib/auth/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/users/lookup?email=xxx
 *
 * Check if an email belongs to an existing user.
 * Returns only { exists: boolean } to avoid leaking PII.
 *
 * Security: restricted to project owners only.
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()

    // Only users can look up other users, not API keys
    if (identity.type !== 'user') {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    const adminClient = createAdminClient()

    // Verify caller owns at least one project
    const { count, error: countError } = await adminClient
      .from('project_members')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', identity.userId)
      .eq('role', 'owner')
      .eq('status', 'active')

    if (countError) {
      console.error('[users.lookup] failed to check project ownership', countError)
      return NextResponse.json({ error: 'Failed to verify permissions.' }, { status: 500 })
    }

    if (!count || count === 0) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    // Validate email param
    const { searchParams } = new URL(request.url)
    const email = searchParams.get('email')

    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email parameter is required.' }, { status: 400 })
    }

    const normalizedEmail = email.toLowerCase().trim()

    // Search for the user by paginating through auth users
    let exists = false
    let page = 1

    while (true) {
      const {
        data: { users },
        error: listError,
      } = await adminClient.auth.admin.listUsers({ page, perPage: 100 })

      if (listError || !users || users.length === 0) break

      if (users.some((u) => u.email?.toLowerCase() === normalizedEmail)) {
        exists = true
        break
      }

      if (users.length < 100) break
      page++
    }

    return NextResponse.json({ exists })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[users.lookup] unexpected error', error)
    return NextResponse.json({ error: 'Failed to look up user.' }, { status: 500 })
  }
}
