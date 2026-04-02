import { db } from '@/lib/db'
import { rateLimitEvents } from '@/lib/db/schema/app'
import { and, eq, gt, count, lt } from 'drizzle-orm'

/**
 * Rate limiter interface with pluggable backends.
 *
 * Controlled by RATE_LIMITER env var:
 * - "memory" (default) - in-memory Map, works for single-process dev
 * - "db" - uses rate_limit_events table, works across serverless instances
 */
export interface RateLimiter {
  /**
   * Check if a request is allowed under the rate limit.
   * @returns true if allowed, false if rate limited
   */
  check(key: string, windowMs: number, maxRequests: number): Promise<boolean>
}

// ---------------------------------------------------------------------------
// In-memory implementation (dev / single-process)
// ---------------------------------------------------------------------------

class MemoryRateLimiter implements RateLimiter {
  private timestamps = new Map<string, number[]>()

  async check(key: string, windowMs: number, maxRequests: number): Promise<boolean> {
    const now = Date.now()
    const existing = this.timestamps.get(key) ?? []
    const recent = existing.filter((t) => now - t < windowMs)

    if (recent.length >= maxRequests) {
      this.timestamps.set(key, recent)
      return false
    }

    recent.push(now)
    this.timestamps.set(key, recent)
    return true
  }
}

// ---------------------------------------------------------------------------
// Database implementation (serverless / production)
// ---------------------------------------------------------------------------

class DbRateLimiter implements RateLimiter {
  async check(key: string, windowMs: number, maxRequests: number): Promise<boolean> {
    const windowStart = new Date(Date.now() - windowMs)

    const [result] = await db
      .select({ total: count() })
      .from(rateLimitEvents)
      .where(and(eq(rateLimitEvents.key, key), gt(rateLimitEvents.created_at, windowStart)))

    if ((result?.total ?? 0) >= maxRequests) {
      return false
    }

    await db.insert(rateLimitEvents).values({ key })

    // Fire-and-forget cleanup of expired rows (1 in 20 chance to avoid overhead on every call)
    if (Math.random() < 0.05) {
      db.delete(rateLimitEvents)
        .where(lt(rateLimitEvents.created_at, windowStart))
        .then(() => {})
        .catch(() => {})
    }

    return true
  }
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

let _limiter: RateLimiter | null = null

export function getRateLimiter(): RateLimiter {
  if (!_limiter) {
    const strategy = process.env.RATE_LIMITER ?? 'memory'
    _limiter = strategy === 'db' ? new DbRateLimiter() : new MemoryRateLimiter()
  }
  return _limiter
}

/**
 * Reset the singleton (for testing).
 */
export function resetRateLimiter(): void {
  _limiter = null
}
