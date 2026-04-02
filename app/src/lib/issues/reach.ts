/**
 * Reach Score Computation
 *
 * Pure algorithm, no AI. Computes reach from session timestamps and session count.
 * Measures how many users/customers an issue is affecting and how quickly it spreads.
 */

const DEFAULT_WINDOW_DAYS = 14

interface ReachInput {
  sessionTimestamps: Date[]
  sessionCount: number
  windowDays?: number
}

interface ReachResult {
  score: number // 1-5
  reasoning: string
}

/**
 * Compute reach score from session timestamps and session count.
 *
 * Score 1-5:
 * - 5: density >= 1.0/day with positive acceleration
 * - 4: density >= 0.5/day OR 5+ sessions
 * - 3: density >= 0.25/day OR 3-4 sessions
 * - 2: 2+ sessions in window
 * - 1: single mention or stale
 */
export function computeReach(input: ReachInput): ReachResult {
  const { sessionTimestamps, sessionCount, windowDays = DEFAULT_WINDOW_DAYS } = input

  if (sessionTimestamps.length === 0) {
    return { score: 1, reasoning: 'No session data available' }
  }

  const now = new Date()
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000)
  const halfWindowStart = new Date(now.getTime() - (windowDays / 2) * 24 * 60 * 60 * 1000)

  // Count sessions in window
  const sessionsInWindow = sessionTimestamps.filter((t) => t >= windowStart)
  const sessionsInRecentHalf = sessionTimestamps.filter((t) => t >= halfWindowStart)
  const sessionsInOlderHalf = sessionsInWindow.filter((t) => t < halfWindowStart)

  // Calculate density (sessions per day)
  const density = sessionsInWindow.length / windowDays

  // Calculate acceleration (recent half vs older half)
  const recentRate = sessionsInRecentHalf.length / (windowDays / 2)
  const olderRate = sessionsInOlderHalf.length / (windowDays / 2)
  const acceleration = recentRate - olderRate

  // Determine score
  let score: number
  const reasons: string[] = []

  if (density >= 1.0 && acceleration > 0) {
    score = 5
    reasons.push(`High density (${density.toFixed(2)}/day) with positive acceleration`)
  } else if (density >= 0.5 || sessionCount >= 5) {
    score = 4
    if (density >= 0.5) reasons.push(`Moderate-high density (${density.toFixed(2)}/day)`)
    if (sessionCount >= 5) reasons.push(`${sessionCount} linked sessions`)
  } else if (density >= 0.25 || (sessionCount >= 3 && sessionCount < 5)) {
    score = 3
    if (density >= 0.25) reasons.push(`Moderate density (${density.toFixed(2)}/day)`)
    if (sessionCount >= 3) reasons.push(`${sessionCount} linked sessions`)
  } else if (sessionsInWindow.length >= 2) {
    score = 2
    reasons.push(`${sessionsInWindow.length} sessions in ${windowDays}-day window`)
  } else {
    score = 1
    if (sessionsInWindow.length === 1) {
      reasons.push('Single mention in window')
    } else {
      reasons.push('No recent activity')
    }
  }

  if (acceleration > 0 && score < 5) {
    reasons.push('accelerating')
  } else if (acceleration < 0) {
    reasons.push('decelerating')
  }

  return {
    score,
    reasoning: reasons.join('; '),
  }
}
