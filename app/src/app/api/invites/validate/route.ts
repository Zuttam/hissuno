import { NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { validateInviteCode } from '@/lib/invites/invite-service'

export const runtime = 'nodejs'

/**
 * Public endpoint to validate an invite code before signup.
 * Does not require authentication.
 */
export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { searchParams } = new URL(request.url)
    const code = searchParams.get('code')

    if (!code) {
      return NextResponse.json({ valid: false, error: 'Invite code is required.' })
    }

    const result = await validateInviteCode(code)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[api.invites.validate] unexpected error', error)
    return NextResponse.json({ valid: false, error: 'Failed to validate invite code.' })
  }
}
