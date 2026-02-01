import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { getWebhookSecret } from '@/lib/billing/lemon-squeezy'
import { getPlanById } from '@/lib/billing/plans-cache'
import { findInviteUsedByUser, markPromotionEligible } from '@/lib/promotions/promotion-service'

export const runtime = 'nodejs'

interface LemonSqueezyWebhookPayload {
  meta: {
    event_name: string
    custom_data?: {
      user_id?: string
      plan_id?: string
      plan_name?: string
    }
  }
  data: {
    id: string
    type: string
    attributes: {
      store_id: number
      customer_id: number
      order_id?: number
      product_id?: number
      variant_id?: number
      status: string
      ends_at?: string | null
      renews_at?: string | null
      created_at: string
      updated_at: string
    }
  }
}

function verifySignature(payload: string, signature: string | null): boolean {
  const secret = getWebhookSecret()
  if (!secret || !signature) return false

  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(payload)
  const digest = hmac.digest('hex')

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest))
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const rawBody = await request.text()
    const signature = request.headers.get('x-signature')

    // Verify webhook signature
    if (!verifySignature(rawBody, signature)) {
      console.error('[webhook.lemon-squeezy] Invalid signature')
      return NextResponse.json({ error: 'Invalid signature.' }, { status: 401 })
    }

    const payload: LemonSqueezyWebhookPayload = JSON.parse(rawBody)
    const eventName = payload.meta.event_name
    const customData = payload.meta.custom_data

    console.log(`[webhook.lemon-squeezy] Received event: ${eventName}`)

    // Get admin client for bypassing RLS
    const supabase = createAdminClient()

    switch (eventName) {
      case 'subscription_created': {
        const userId = customData?.user_id
        const planId = customData?.plan_id
        const planName = customData?.plan_name

        if (!userId || !planId) {
          console.error('[webhook.lemon-squeezy] Missing user_id or plan_id in custom data')
          return NextResponse.json({ error: 'Missing custom data.' }, { status: 400 })
        }

        // Get plan details from cache to copy limits
        const plan = await getPlanById(planId)
        const sessionsLimit = plan?.limits.sessions_limit ?? null
        const projectsLimit = plan?.limits.projects_limit ?? null
        const resolvedPlanName = planName ?? plan?.name ?? null

        // Create subscription record with plan limits
        const { error: insertError } = await supabase.from('subscriptions').upsert(
          {
            user_id: userId,
            plan_id: planId,
            plan_name: resolvedPlanName,
            sessions_limit: sessionsLimit,
            projects_limit: projectsLimit,
            lemon_squeezy_subscription_id: payload.data.id,
            lemon_squeezy_customer_id: String(payload.data.attributes.customer_id),
            status: mapStatus(payload.data.attributes.status),
            current_period_end: payload.data.attributes.renews_at || payload.data.attributes.ends_at,
          },
          { onConflict: 'user_id' }
        )

        if (insertError) {
          console.error('[webhook.lemon-squeezy] Failed to create subscription', insertError)
          return NextResponse.json({ error: 'Failed to create subscription.' }, { status: 500 })
        }

        console.log(`[webhook.lemon-squeezy] Created subscription for user ${userId} with plan ${resolvedPlanName}`)

        // Mark referral promotion as eligible for the inviter
        try {
          const inviteId = await findInviteUsedByUser(userId)
          if (inviteId) {
            await markPromotionEligible(inviteId)
            console.log(`[webhook.lemon-squeezy] Marked promotion eligible for invite ${inviteId}`)
          }
        } catch (promoError) {
          // Log but don't fail the webhook
          console.error('[webhook.lemon-squeezy] Failed to mark promotion eligible:', promoError)
        }
        break
      }

      case 'subscription_updated': {
        const subscriptionId = payload.data.id
        const variantId = payload.data.attributes.variant_id

        // Find subscription by Lemon Squeezy ID
        const { data: subscription } = await supabase
          .from('subscriptions')
          .select('id, plan_id')
          .eq('lemon_squeezy_subscription_id', subscriptionId)
          .single()

        if (subscription) {
          // Check if plan changed
          const newPlanId = variantId ? String(variantId) : null
          const planChanged = newPlanId && newPlanId !== subscription.plan_id

          // Build update object
          const updateData: Record<string, unknown> = {
            status: mapStatus(payload.data.attributes.status),
            current_period_end: payload.data.attributes.renews_at || payload.data.attributes.ends_at,
          }

          // If plan changed, update limits from new plan
          if (planChanged && newPlanId) {
            const newPlan = await getPlanById(newPlanId)
            if (newPlan) {
              updateData.plan_id = newPlanId
              updateData.plan_name = newPlan.name
              updateData.sessions_limit = newPlan.limits.sessions_limit
              updateData.projects_limit = newPlan.limits.projects_limit
              console.log(`[webhook.lemon-squeezy] Plan changed to ${newPlan.name}`)
            }
          }

          const { error: updateError } = await supabase
            .from('subscriptions')
            .update(updateData)
            .eq('id', subscription.id)

          if (updateError) {
            console.error('[webhook.lemon-squeezy] Failed to update subscription', updateError)
          }
        }
        break
      }

      case 'subscription_cancelled': {
        const subscriptionId = payload.data.id

        const { error: updateError } = await supabase
          .from('subscriptions')
          .update({
            status: 'cancelled',
            current_period_end: payload.data.attributes.ends_at,
          })
          .eq('lemon_squeezy_subscription_id', subscriptionId)

        if (updateError) {
          console.error('[webhook.lemon-squeezy] Failed to cancel subscription', updateError)
        }
        break
      }

      default:
        console.log(`[webhook.lemon-squeezy] Unhandled event: ${eventName}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[webhook.lemon-squeezy] Error processing webhook', error)
    return NextResponse.json({ error: 'Webhook processing failed.' }, { status: 500 })
  }
}

function mapStatus(lemonStatus: string): string {
  const statusMap: Record<string, string> = {
    active: 'active',
    cancelled: 'cancelled',
    expired: 'expired',
    past_due: 'past_due',
    on_trial: 'on_trial',
    paused: 'paused',
  }
  return statusMap[lemonStatus] ?? 'active'
}
