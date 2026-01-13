import { NextResponse } from 'next/server'
import { createCheckout } from '@lemonsqueezy/lemonsqueezy.js'
import { requireSessionUser, UnauthorizedError } from '@/lib/auth/server'
import { createClient } from '@/lib/supabase/server'
import {
  configureLemonSqueezy,
  isLemonSqueezyConfigured,
  getStoreId,
} from '@/lib/billing/lemon-squeezy'
import { getPlanById } from '@/lib/billing/plans-cache'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  if (!isLemonSqueezyConfigured()) {
    return NextResponse.json({ error: 'Billing is not configured.' }, { status: 500 })
  }

  try {
    const user = await requireSessionUser()
    const supabase = await createClient()
    const body = await request.json()
    const { planId, redirectPath = '/onboarding' } = body

    if (!planId) {
      return NextResponse.json({ error: 'Plan ID is required.' }, { status: 400 })
    }

    // Get plan details from cache (planId is now the LS variant ID)
    const plan = await getPlanById(planId)

    if (!plan) {
      return NextResponse.json({ error: 'Plan not found.' }, { status: 404 })
    }

    // Configure Lemon Squeezy SDK
    configureLemonSqueezy()

    const storeId = getStoreId()
    if (!storeId) {
      return NextResponse.json({ error: 'Store ID not configured.' }, { status: 500 })
    }

    // Get user email for checkout
    const { data: authUser } = await supabase.auth.getUser()
    const email = authUser.user?.email

    // Create checkout URL (variant ID must be a number)
    const variantId = parseInt(plan.id, 10)
    const { data: checkout, error: checkoutError } = await createCheckout(storeId, variantId, {
      checkoutData: {
        email: email ?? undefined,
        custom: {
          user_id: user.id,
          plan_id: plan.id,
          plan_name: plan.name,
        },
      },
      productOptions: {
        redirectUrl: `${process.env.NEXT_PUBLIC_APP_URL}${redirectPath}?checkout=success`,
      },
    })

    if (checkoutError) {
      console.error('[billing.checkout.post] failed to create checkout', checkoutError)
      return NextResponse.json({ error: 'Failed to create checkout.' }, { status: 500 })
    }

    return NextResponse.json({
      checkoutUrl: checkout?.data?.attributes?.url ?? null,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[billing.checkout.post] unexpected error', error)
    return NextResponse.json({ error: 'Failed to create checkout.' }, { status: 500 })
  }
}
