import { NextResponse } from 'next/server'
import { requireSessionUser, UnauthorizedError } from '@/lib/auth/server'
import { isLemonSqueezyConfigured } from '@/lib/billing/lemon-squeezy'
import { getBillingInfo } from '@/lib/billing/billing-service'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const user = await requireSessionUser()

    if (!isLemonSqueezyConfigured()) {
      return NextResponse.json({ error: 'Billing is not configured.' }, { status: 500 })
    }

    const billingInfo = await getBillingInfo(user.id)
    return NextResponse.json({ billingInfo })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[billing.info.get] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load billing info.' }, { status: 500 })
  }
}
