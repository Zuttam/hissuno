import { NextResponse } from 'next/server'
import { requireSessionUser, UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { getUserPromotions } from '@/lib/promotions/promotion-service'

export const runtime = 'nodejs'

/**
 * Returns the authenticated user's promotions.
 */
export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const user = await requireSessionUser()
    const promotions = await getUserPromotions(user.id)

    return NextResponse.json({ promotions })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[api.user.promotions] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch promotions.' }, { status: 500 })
  }
}
