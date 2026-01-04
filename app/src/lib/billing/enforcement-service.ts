/**
 * Subscription enforcement service
 *
 * Centralized limit checking and enforcement for subscription dimensions.
 * Supports both hard enforcement (blocking) and soft enforcement (degraded mode).
 */

import { getBillingInfo } from './billing-service'
import { sendLimitNotificationIfNeeded } from './limit-notifications'
import type { Subscription, UsageMetrics } from '@/types/billing'
import type {
  EnforcementCheckOptions,
  EnforcementResult,
  LimitDimension,
} from './enforcement-types'
import { LimitExceededError } from './enforcement-types'

const LOG_PREFIX = '[enforcement-service]'

/**
 * Check if a subscription is currently valid for limit purposes.
 *
 * Valid statuses:
 * - 'active': Normal active subscription
 * - 'on_trial': Trial period (LemonSqueezy updates to 'active' when trial ends)
 * - 'past_due': Payment failed but in grace period (give them time to fix)
 * - 'cancelled': Valid until current_period_end (they paid for this period)
 *
 * Invalid (blocked):
 * - 'paused', 'expired': No access
 * - No subscription: No access
 */
function isSubscriptionValid(subscription: Subscription | null): boolean {
  if (!subscription) return false

  const { status, current_period_end } = subscription

  // Active and trial subscriptions are always valid
  if (status === 'active' || status === 'on_trial') return true

  // Past due: give grace period for payment retry
  if (status === 'past_due') return true

  // Cancelled: valid until period ends
  if (status === 'cancelled' && current_period_end) {
    return new Date(current_period_end) > new Date()
  }

  // Paused, expired, or unknown: blocked
  return false
}

/**
 * Get the limit value for a dimension from subscription
 *
 * To add a new dimension:
 * 1. Add to LimitDimension type
 * 2. Add case here returning the limit from subscription
 */
function getLimitForDimension(
  subscription: Subscription | null,
  dimension: LimitDimension
): number | null {
  // No valid subscription = blocked (limit of 0)
  if (!isSubscriptionValid(subscription)) {
    return 0
  }

  switch (dimension) {
    case 'sessions':
      return subscription!.sessions_limit
    case 'projects':
      return subscription!.projects_limit
    // Add new dimensions here:
    // case 'issues':
    //   return subscription!.issues_limit
    default:
      return null
  }
}

/**
 * Get current usage for a dimension
 *
 * To add a new dimension:
 * 1. Ensure usage is calculated in getUsageMetrics()
 * 2. Add case here returning the usage value
 */
function getUsageForDimension(usage: UsageMetrics, dimension: LimitDimension): number {
  switch (dimension) {
    case 'sessions':
      return usage.sessionsUsed
    case 'projects':
      return usage.projectsUsed
    // Add new dimensions here:
    // case 'issues':
    //   return usage.issuesUsed
    default:
      return 0
  }
}

/**
 * Check if an action is allowed based on subscription limits
 *
 * @returns EnforcementResult with allowed status and usage info
 */
export async function checkEnforcement(
  options: EnforcementCheckOptions
): Promise<EnforcementResult> {
  const { userId, dimension, mode, increment = 1 } = options

  const billingInfo = await getBillingInfo(userId)
  const { subscription, usage } = billingInfo

  const limit = getLimitForDimension(subscription, dimension)
  const current = getUsageForDimension(usage, dimension)

  // null limit = unlimited
  if (limit === null) {
    return {
      allowed: true,
      isOverLimit: false,
      dimension,
      current,
      limit: null,
      remaining: null,
      message: 'Unlimited',
    }
  }

  const wouldExceed = current + increment > limit
  const isAtLimit = current >= limit
  const remaining = Math.max(0, limit - current)

  // Determine if action is allowed based on mode
  // - hard: block if would exceed
  // - soft: always allow (for external channels like widget/slack)
  const allowed = mode === 'soft' ? true : !wouldExceed

  const dimensionLabel = dimension.replace('_', ' ')
  const message = wouldExceed
    ? `${dimensionLabel.charAt(0).toUpperCase() + dimensionLabel.slice(1)} limit reached (${current}/${limit}). Upgrade your plan to continue.`
    : `${remaining} ${dimensionLabel} remaining`

  const result: EnforcementResult = {
    allowed,
    isOverLimit: isAtLimit || wouldExceed,
    dimension,
    current,
    limit,
    remaining,
    message,
  }

  if (result.isOverLimit) {
    result.upgradeUrl = '/account/billing'

    // Send notification (fire and forget - don't block the request)
    void sendLimitNotificationIfNeeded(userId, result)
  }

  return result
}

/**
 * Enforce a limit with hard mode - throws LimitExceededError if not allowed
 *
 * Use this for manual creation endpoints (projects, manual sessions)
 *
 * @throws LimitExceededError if limit would be exceeded
 */
export async function enforceLimit(
  options: Omit<EnforcementCheckOptions, 'mode'>
): Promise<EnforcementResult> {
  const result = await checkEnforcement({ ...options, mode: 'hard' })

  if (!result.allowed) {
    console.log(`${LOG_PREFIX} limit exceeded`, {
      userId: options.userId,
      dimension: result.dimension,
      current: result.current,
      limit: result.limit,
    })
    throw new LimitExceededError(result)
  }

  return result
}

/**
 * Check session limit with soft enforcement for external channels
 *
 * Use this for widget and Slack sessions - they should still be created
 * but marked as over_limit so PM review is skipped.
 *
 * @returns Object with allowed (always true) and isOverLimit flag
 */
export async function checkSessionLimitSoft(
  userId: string,
  projectId: string
): Promise<{ allowed: true; isOverLimit: boolean }> {
  const result = await checkEnforcement({
    userId,
    projectId,
    dimension: 'sessions',
    mode: 'soft',
  })

  if (result.isOverLimit) {
    console.log(`${LOG_PREFIX} session over limit (soft enforcement)`, {
      userId,
      projectId,
      current: result.current,
      limit: result.limit,
    })
  }

  return {
    allowed: true,
    isOverLimit: result.isOverLimit,
  }
}

// Re-export error class for consumers
export { LimitExceededError }
