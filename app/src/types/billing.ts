/**
 * Billing type definitions for Lemon Squeezy integration
 */

/**
 * Subscription status values
 */
export type SubscriptionStatus =
  | 'active'
  | 'cancelled'
  | 'expired'
  | 'past_due'
  | 'on_trial'
  | 'paused'

/**
 * Plan limits (metered dimensions)
 */
export interface PlanLimits {
  /** Maximum sessions per billing period. null = unlimited */
  sessions_limit: number | null
  /** Maximum analyzed issues per billing period. null = unlimited */
  issues_limit: number | null
}

/**
 * Plan definition from Lemon Squeezy
 */
export interface Plan {
  /** Lemon Squeezy variant ID */
  id: string
  /** Internal plan name: 'basic' | 'pro' | 'max' */
  name: string
  /** Display name from Lemon Squeezy */
  display_name: string
  /** Price in cents (0 = free) */
  price_cents: number
  /** List of feature descriptions */
  features: string[]
  /** Whether this plan is recommended */
  is_recommended: boolean
  /** Metered dimensions (defaults from plan) */
  limits: PlanLimits
}

/**
 * User subscription record
 */
export interface Subscription {
  id: string
  user_id: string
  /** Lemon Squeezy variant ID */
  plan_id: string
  /** Internal plan name: 'basic' | 'pro' | 'unlimited' */
  plan_name: string
  /** Per-user session limit (from plan, can be overridden). null = unlimited */
  sessions_limit: number | null
  /** Per-user analyzed issues limit (from plan, can be overridden). null = unlimited */
  issues_limit: number | null
  /** Subscription status */
  status: SubscriptionStatus
  /** When the current period ends (next billing date) */
  current_period_end: string | null
  /** Lemon Squeezy subscription ID for API calls */
  lemon_squeezy_subscription_id: string | null
  /** Lemon Squeezy customer ID for customer portal */
  lemon_squeezy_customer_id: string | null
  created_at: string
  updated_at: string
}

/**
 * Usage metrics for current billing period
 */
export interface UsageMetrics {
  /** Number of analyzed sessions this period (sessions with pm_reviewed_at set) */
  analyzedSessionsUsed: number
  /** Analyzed session limit for this user (from subscription). null = unlimited */
  analyzedSessionsLimit: number | null
  /** Number of analyzed issues this period (issues with analysis_computed_at set) */
  analyzedIssuesUsed: number
  /** Analyzed issues limit for this user (from subscription). null = unlimited */
  analyzedIssuesLimit: number | null
  /** Start of current billing period */
  periodStart: string
  /** End of current billing period (next billing date) */
  periodEnd: string | null
}

/**
 * Complete billing info for a user
 */
export interface BillingInfo {
  /** User's subscription (null if free tier / no subscription) */
  subscription: Subscription | null
  /** Plan details (null if no subscription) */
  plan: Plan | null
  /** Usage metrics for current period */
  usage: UsageMetrics
  /** URL to Lemon Squeezy customer portal (null if no customer) */
  customerPortalUrl: string | null
}
