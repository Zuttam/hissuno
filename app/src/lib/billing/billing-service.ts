/**
 * Billing service for subscription and usage management
 */

import { getCustomer } from '@lemonsqueezy/lemonsqueezy.js'
import { createClient } from '@/lib/supabase/server'
import { configureLemonSqueezy } from './lemon-squeezy'
import { getPlanById } from './plans-cache'
import type { BillingInfo, Subscription, UsageMetrics, Plan, PlanLimits } from '@/types/billing'

/**
 * Get complete billing info for a user
 */
export async function getBillingInfo(userId: string): Promise<BillingInfo> {
  const supabase = await createClient()

  // Get user's subscription from database
  const { data: subscriptionData } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single()

  // Map to typed subscription
  const subscription: Subscription | null = subscriptionData
    ? {
        id: subscriptionData.id,
        user_id: subscriptionData.user_id,
        plan_id: subscriptionData.plan_id,
        plan_name: subscriptionData.plan_name ?? '',
        sessions_limit: subscriptionData.sessions_limit,
        projects_limit: subscriptionData.projects_limit,
        status: subscriptionData.status,
        current_period_end: subscriptionData.current_period_end,
        lemon_squeezy_subscription_id: subscriptionData.lemon_squeezy_subscription_id,
        lemon_squeezy_customer_id: subscriptionData.lemon_squeezy_customer_id,
        created_at: subscriptionData.created_at,
        updated_at: subscriptionData.updated_at,
      }
    : null

  // Get plan details from cache (if subscription exists)
  let plan: Plan | null = null
  if (subscription?.plan_id) {
    plan = (await getPlanById(subscription.plan_id)) ?? null
  }

  // Get usage metrics
  const usage = await getUsageMetrics(userId, subscription)

  // Get customer portal URL if customer exists
  let customerPortalUrl: string | null = null
  if (subscription?.lemon_squeezy_customer_id) {
    customerPortalUrl = await getCustomerPortalUrl(subscription.lemon_squeezy_customer_id)
  }

  return {
    subscription,
    plan,
    usage,
    customerPortalUrl,
  }
}

/**
 * Get usage metrics for a user
 */
export async function getUsageMetrics(
  userId: string,
  subscription: Subscription | null
): Promise<UsageMetrics> {
  const supabase = await createClient()

  // Calculate period start (beginning of current billing period or month)
  const now = new Date()
  let periodStart: Date
  let periodEnd: string | null = subscription?.current_period_end ?? null

  if (periodEnd) {
    // If we have a period end, calculate start based on monthly billing
    const end = new Date(periodEnd)
    periodStart = new Date(end)
    periodStart.setMonth(periodStart.getMonth() - 1)
  } else {
    // Default to current month
    periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
  }

  // Get all project IDs owned by this user
  const { data: userProjects, error: projectsListError } = await supabase
    .from('projects')
    .select('id')
    .eq('user_id', userId)

  if (projectsListError) {
    console.error('[billing-service] failed to list user projects', projectsListError)
  }

  const projectIds = userProjects?.map((p) => p.id) ?? []

  // Count analyzed sessions (pm_reviewed_at IS NOT NULL) in the current period for user's projects
  let analyzedSessionsCount = 0
  if (projectIds.length > 0) {
    const { count, error: sessionsError } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .in('project_id', projectIds)
      .not('pm_reviewed_at', 'is', null)
      .gte('pm_reviewed_at', periodStart.toISOString())

    if (sessionsError) {
      console.error('[billing-service] failed to count analyzed sessions', sessionsError)
    }
    analyzedSessionsCount = count ?? 0
  }

  // Count projects
  const { count: projectsCount, error: projectsError } = await supabase
    .from('projects')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)

  if (projectsError) {
    console.error('[billing-service] failed to count projects', projectsError)
  }

  // Get limits from subscription (null = unlimited if no subscription)
  const analyzedSessionsLimit = subscription?.sessions_limit ?? null
  const projectsLimit = subscription?.projects_limit ?? null

  return {
    analyzedSessionsUsed: analyzedSessionsCount,
    analyzedSessionsLimit,
    projectsUsed: projectsCount ?? 0,
    projectsLimit,
    periodStart: periodStart.toISOString(),
    periodEnd,
  }
}

/**
 * Get Lemon Squeezy customer portal URL
 */
async function getCustomerPortalUrl(customerId: string): Promise<string | null> {
  try {
    configureLemonSqueezy()

    const { data: customerResponse, error } = await getCustomer(customerId)

    if (error || !customerResponse?.data) {
      console.error('[billing-service] failed to get customer', error)
      return null
    }

    return customerResponse.data.attributes.urls?.customer_portal ?? null
  } catch (error) {
    console.error('[billing-service] failed to get customer portal URL', error)
    return null
  }
}

/**
 * Sync subscription limits from plan defaults
 *
 * Called after subscription creation to copy plan limits to subscription record.
 */
export async function syncSubscriptionLimitsFromPlan(
  subscriptionId: string,
  planId: string
): Promise<void> {
  const supabase = await createClient()
  const plan = await getPlanById(planId)

  if (!plan) {
    console.error('[billing-service] plan not found for syncing limits', planId)
    return
  }

  const { error } = await supabase
    .from('subscriptions')
    .update({
      plan_name: plan.name,
      sessions_limit: plan.limits.sessions_limit,
      projects_limit: plan.limits.projects_limit,
    })
    .eq('id', subscriptionId)

  if (error) {
    console.error('[billing-service] failed to sync subscription limits', error)
  } else {
    console.log(`[billing-service] synced limits for subscription ${subscriptionId}`)
  }
}

/**
 * Get plan limits for a variant ID (for use in webhooks)
 */
export async function getPlanLimits(variantId: string): Promise<PlanLimits | null> {
  const plan = await getPlanById(variantId)
  return plan?.limits ?? null
}
