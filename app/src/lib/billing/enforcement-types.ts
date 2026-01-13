/**
 * Subscription enforcement types
 *
 * Extensible system for limit checking and enforcement.
 * To add a new dimension, add it to LimitDimension and implement
 * the corresponding getters in enforcement-service.ts
 */

/**
 * Limit dimension identifiers
 *
 * Add new dimensions here as needed (e.g., 'issues', 'team_members')
 */
export type LimitDimension = 'sessions' | 'projects'

/**
 * Enforcement mode determines behavior when limit is reached
 *
 * - 'hard': Block the action entirely (for manual creation)
 * - 'soft': Allow but mark as over-limit (for external channels)
 */
export type EnforcementMode = 'hard' | 'soft'

/**
 * Result of an enforcement check
 */
export interface EnforcementResult {
  /** Whether the action is allowed */
  allowed: boolean
  /** Whether the user is currently over their limit */
  isOverLimit: boolean
  /** Which dimension was checked */
  dimension: LimitDimension
  /** Current usage count */
  current: number
  /** Usage limit (null = unlimited) */
  limit: number | null
  /** Remaining quota (null if unlimited) */
  remaining: number | null
  /** Human-readable message */
  message: string
  /** URL to upgrade plan (if over limit) */
  upgradeUrl?: string
}

/**
 * Options for enforcement check
 */
export interface EnforcementCheckOptions {
  /** User to check limits for */
  userId: string
  /** Project context (for session checks) */
  projectId?: string
  /** Which dimension to check */
  dimension: LimitDimension
  /** Enforcement mode */
  mode: EnforcementMode
  /** How many units to add (default 1) */
  increment?: number
}

/**
 * Custom error for limit exceeded (hard enforcement)
 */
export class LimitExceededError extends Error {
  readonly status = 429
  readonly code = 'LIMIT_EXCEEDED'
  readonly dimension: LimitDimension
  readonly result: EnforcementResult

  constructor(result: EnforcementResult) {
    super(result.message)
    this.name = 'LimitExceededError'
    this.dimension = result.dimension
    this.result = result
  }

  /**
   * Convert to API response format
   */
  toResponse(): { error: string; code: string; details: EnforcementResult } {
    return {
      error: this.message,
      code: this.code,
      details: this.result,
    }
  }
}
