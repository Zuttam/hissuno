/**
 * RICE Score Utilities
 *
 * Shared helpers for computing RICE scores from component metrics.
 * Can be imported from both server (mastra/workflows) and client (UI) code.
 */

import type { IssuePriority } from '@/types/issue'

/**
 * Calculate RICE score from Reach, Impact, Confidence, and Effort.
 *
 * Formula: (Reach * Impact * Confidence) / Effort
 * All scores are 1-5. Confidence defaults to 3 (medium) if not provided.
 * Returns null if insufficient data.
 */
export function calculateRICEScore(
  reachScore: number | null,
  impactScore: number | null,
  confidenceScore: number | null,
  effortScore: number | null
): number | null {
  if (reachScore == null || impactScore == null || effortScore == null) return null
  const confidence = confidenceScore ?? 3
  const effort = Math.max(effortScore, 1)
  return (reachScore * impactScore * confidence) / effort
}

/**
 * Map a RICE score to a priority level.
 *
 * Thresholds: >= 20 = high, >= 5 = medium, else low
 */
export function riceScoreToPriority(riceScore: number | null): IssuePriority | null {
  if (riceScore == null) return null
  if (riceScore >= 20) return 'high'
  if (riceScore >= 5) return 'medium'
  return 'low'
}
