/**
 * Effort Score Mapping
 *
 * Maps the existing effort estimate enum to a 1-5 numeric score.
 */

import type { EffortEstimate } from '@/types/issue'

const EFFORT_SCORE_MAP: Record<EffortEstimate, number> = {
  trivial: 1,
  small: 2,
  medium: 3,
  large: 4,
  xlarge: 5,
}

/**
 * Map effort estimate enum to a 1-5 numeric score.
 * Returns null when no estimate is available.
 */
export function mapEffortToScore(estimate: EffortEstimate | null): number | null {
  if (!estimate) return null
  return EFFORT_SCORE_MAP[estimate] ?? null
}

/**
 * Map a 1-5 effort score back to the estimate enum.
 */
export function mapScoreToEffort(score: number): EffortEstimate {
  if (score <= 1) return 'trivial'
  if (score <= 2) return 'small'
  if (score <= 3) return 'medium'
  if (score <= 4) return 'large'
  return 'xlarge'
}
