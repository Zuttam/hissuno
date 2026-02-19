import { NextResponse } from 'next/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { UnauthorizedError } from '@/lib/auth/server'
import { ForbiddenError } from '@/lib/auth/authorization'
import { isLemonSqueezyConfigured } from '@/lib/billing/lemon-squeezy'
import { getBillingInfo } from '@/lib/billing/billing-service'

export const runtime = 'nodejs'

export async function GET() {
  try {
    const identity = await requireUserIdentity()

    if (!isLemonSqueezyConfigured()) {
      return NextResponse.json({ error: 'Billing is not configured.' }, { status: 500 })
    }

    const billingInfo = await getBillingInfo(identity.userId)
    return NextResponse.json({ billingInfo })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[billing.info.get] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load billing info.' }, { status: 500 })
  }
}
