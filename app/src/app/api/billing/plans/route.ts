import { NextResponse } from 'next/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { UnauthorizedError } from '@/lib/auth/server'
import { ForbiddenError } from '@/lib/auth/authorization'
import { isLemonSqueezyConfigured } from '@/lib/billing/lemon-squeezy'
import { getPlans } from '@/lib/billing/plans-cache'

export const runtime = 'nodejs'

export async function GET() {
  try {
    await requireUserIdentity()

    if (!isLemonSqueezyConfigured()) {
      // Return empty plans if Lemon Squeezy not configured
      console.warn('[billing.plans.get] Lemon Squeezy not configured')
      return NextResponse.json({ plans: [] })
    }

    const plans = await getPlans()
    return NextResponse.json({ plans })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[billing.plans.get] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load plans.' }, { status: 500 })
  }
}
