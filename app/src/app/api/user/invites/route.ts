import { NextResponse } from 'next/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { UnauthorizedError } from '@/lib/auth/server'
import { ForbiddenError } from '@/lib/auth/authorization'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { getUserInvites } from '@/lib/invites/invite-service'

export const runtime = 'nodejs'

/**
 * Returns the authenticated user's invites with claim information.
 * Read-only - invites are created by admin in the database.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireUserIdentity()
    const invites = await getUserInvites(identity.userId)

    return NextResponse.json({ invites })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[api.user.invites] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch invites.' }, { status: 500 })
  }
}
