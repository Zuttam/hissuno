/**
 * Plans cache service for Lemon Squeezy integration
 *
 * Fetches plans from Lemon Squeezy API with in-memory caching.
 * Uses HMR-safe global pattern to prevent cache reset in development.
 */

import { listVariants } from '@lemonsqueezy/lemonsqueezy.js'
import { configureLemonSqueezy, getStoreId } from './lemon-squeezy'
import type { Plan, PlanLimits } from '@/types/billing'

// Cache structure
interface PlansCache {
  plans: Plan[]
  timestamp: number
}

// Cache TTL from environment or default to 10 minutes
const CACHE_TTL_MS = parseInt(process.env.PLANS_CACHE_TTL_MS ?? '600000', 10)

// HMR-safe global cache pattern (same as mastra storage)
const globalForCache = globalThis as unknown as { plansCache: PlansCache | undefined }

/**
 * Plan metadata mapping
 *
 * Maps Lemon Squeezy variant IDs to additional metadata not available in the API.
 * Update these IDs after creating products in Lemon Squeezy dashboard.
 */
interface PlanMetadata {
  name: string
  limits: PlanLimits
  features: string[]
  is_recommended: boolean
  sort_order: number
}

function getPlanMetadata(): Record<string, PlanMetadata> {
  const basicId = process.env.LEMONSQUEEZY_VARIANT_ID_BASIC
  const proId = process.env.LEMONSQUEEZY_VARIANT_ID_PRO
  const maxId = process.env.LEMONSQUEEZY_VARIANT_ID_MAX

  const metadata: Record<string, PlanMetadata> = {}

  if (basicId) {
    metadata[basicId] = {
      name: 'basic',
      limits: { sessions_limit: 200, issues_limit: 200 },
      features: ['200 analyzed sessions/month', '200 analyzed issues/month', 'Community support'],
      is_recommended: false,
      sort_order: 1,
    }
  }

  if (proId) {
    metadata[proId] = {
      name: 'pro',
      limits: { sessions_limit: 1000, issues_limit: 1000 },
      features: ['1,000 analyzed sessions/month', '1,000 analyzed issues/month', 'Priority support', 'Custom branding'],
      is_recommended: true,
      sort_order: 2,
    }
  }

  if (maxId) {
    metadata[maxId] = {
      name: 'max',
      limits: { sessions_limit: 10000, issues_limit: 10000 },
      features: [
        '10,000 sessions/month',
        'Unlimited analyzed issues',
        'Dedicated support',
        'Custom integrations',
        'SLA guarantee',
      ],
      is_recommended: false,
      sort_order: 3,
    }
  }

  return metadata
}

/**
 * Check if the cache is still valid based on TTL
 */
function isCacheValid(cache: PlansCache | undefined): boolean {
  if (!cache) return false
  return Date.now() - cache.timestamp < CACHE_TTL_MS
}

/**
 * Fetch plans from Lemon Squeezy API or return cached plans
 */
export async function getPlans(): Promise<Plan[]> {
  // Check cache first
  if (isCacheValid(globalForCache.plansCache)) {
    console.debug('[plans-cache] returning cached plans')
    return globalForCache.plansCache!.plans
  }

  console.debug('[plans-cache] fetching plans from Lemon Squeezy')

  try {
    configureLemonSqueezy()
    const storeId = getStoreId()

    if (!storeId) {
      console.error('[plans-cache] store ID not configured')
      return globalForCache.plansCache?.plans ?? []
    }

    // Get the variant IDs we care about from metadata
    const planMetadata = getPlanMetadata()
    const variantIds = Object.keys(planMetadata)

    if (variantIds.length === 0) {
      console.warn('[plans-cache] no variant IDs configured in environment')
      return []
    }

    // Fetch all variants and filter to the ones we care about
    const { data: variantsResponse, error: variantsError } = await listVariants()

    if (variantsError || !variantsResponse?.data) {
      console.error('[plans-cache] failed to fetch variants', variantsError)
      // Return stale cache if available
      return globalForCache.plansCache?.plans ?? []
    }

    // Filter to only the variants we care about (defined in metadata)
    const filteredVariants = variantsResponse.data.filter((variant) =>
      variantIds.includes(String(variant.id))
    )

    // Transform filtered variants to Plan interface
    const plans: Plan[] = filteredVariants
      .filter((variant) => variant.attributes.status === 'published')
      .map((variant) => {
        const variantId = String(variant.id)
        const metadata = planMetadata[variantId]

        // Skip variants without metadata mapping (shouldn't happen since we filtered)
        if (!metadata) {
          console.warn(`[plans-cache] no metadata for variant ${variantId}, skipping`)
          return null
        }

        return {
          id: variantId,
          name: metadata.name,
          display_name: variant.attributes.name,
          price_cents: variant.attributes.price ?? 0,
          features: metadata.features,
          is_recommended: metadata.is_recommended,
          limits: metadata.limits,
          _sort_order: metadata.sort_order,
        }
      })
      .filter((plan): plan is Plan & { _sort_order: number } => plan !== null)
      .sort((a, b) => a._sort_order - b._sort_order)
      .map(({ _sort_order, ...plan }) => plan)

    // Update cache
    globalForCache.plansCache = {
      plans,
      timestamp: Date.now(),
    }

    console.debug(`[plans-cache] cached ${plans.length} plans`)
    return plans
  } catch (error) {
    console.error('[plans-cache] unexpected error', error)
    // Return stale cache if available
    if (globalForCache.plansCache) {
      console.log('[plans-cache] returning stale cache after error')
      return globalForCache.plansCache.plans
    }
    return []
  }
}

/**
 * Get a single plan by variant ID
 */
export async function getPlanById(variantId: string): Promise<Plan | undefined> {
  const plans = await getPlans()
  return plans.find((p) => p.id === variantId)
}

/**
 * Get a single plan by internal name
 */
export async function getPlanByName(name: string): Promise<Plan | undefined> {
  const plans = await getPlans()
  return plans.find((p) => p.name === name)
}

/**
 * Invalidate the plans cache (force re-fetch on next call)
 */
export function invalidatePlansCache(): void {
  globalForCache.plansCache = undefined
  console.log('[plans-cache] cache invalidated')
}

/**
 * Get the current cache state (for debugging)
 */
export function getCacheState(): { isCached: boolean; age: number | null; planCount: number } {
  const cache = globalForCache.plansCache
  if (!cache) {
    return { isCached: false, age: null, planCount: 0 }
  }
  return {
    isCached: true,
    age: Date.now() - cache.timestamp,
    planCount: cache.plans.length,
  }
}
