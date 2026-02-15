/**
 * Enhanced Impact Score Computation
 *
 * Blends technical impact (from Technical Analyst agent) with customer data.
 */

interface CustomerSession {
  contactId: string | null
  companyId: string | null
  companyArr: number | null
  companyStage: string | null
}

interface ImpactInput {
  technicalImpactScore: number | null // 1-5 from agent
  sessions: CustomerSession[]
}

interface ImpactResult {
  score: number // 1-5
  reasoning: string
}

/**
 * Compute customer score from session data.
 *
 * ARR buckets: $200K+=5, $50-200K=4, $10-50K=3, <$10K=2, none=1
 * Breadth: unique contacts and companies
 * Stage weighting: active/expansion > churned > onboarding > prospect
 */
function computeCustomerScore(sessions: CustomerSession[]): { score: number; reasoning: string } {
  if (sessions.length === 0) {
    return { score: 1, reasoning: 'No customer data' }
  }

  const uniqueContacts = new Set(sessions.map((s) => s.contactId).filter(Boolean))
  const uniqueCompanies = new Set(sessions.map((s) => s.companyId).filter(Boolean))

  // Calculate max ARR
  const arrValues = sessions.map((s) => s.companyArr).filter((v): v is number => v != null && v > 0)
  const maxArr = arrValues.length > 0 ? Math.max(...arrValues) : 0
  const totalArr = arrValues.reduce((sum, v) => sum + v, 0)

  // ARR score
  let arrScore: number
  if (totalArr >= 200_000) arrScore = 5
  else if (totalArr >= 50_000) arrScore = 4
  else if (totalArr >= 10_000) arrScore = 3
  else if (totalArr > 0) arrScore = 2
  else arrScore = 1

  // Breadth score
  let breadthScore: number
  if (uniqueCompanies.size >= 5) breadthScore = 5
  else if (uniqueCompanies.size >= 3) breadthScore = 4
  else if (uniqueCompanies.size >= 2) breadthScore = 3
  else if (uniqueContacts.size >= 2) breadthScore = 2
  else breadthScore = 1

  // Stage weighting
  const stageWeights: Record<string, number> = {
    active: 1.2,
    expansion: 1.3,
    churned: 1.1,
    onboarding: 1.0,
    prospect: 0.8,
  }
  const stages = sessions.map((s) => s.companyStage).filter(Boolean) as string[]
  const maxWeight = stages.length > 0
    ? Math.max(...stages.map((s) => stageWeights[s] ?? 1.0))
    : 1.0

  // Combine: 60% ARR, 30% breadth, 10% stage bonus
  const rawScore = arrScore * 0.6 + breadthScore * 0.3 + (maxWeight > 1 ? 1 : 0) * 0.5
  const score = Math.min(5, Math.max(1, Math.round(rawScore)))

  const reasons: string[] = []
  if (totalArr > 0) reasons.push(`$${formatCompact(totalArr)} ARR affected`)
  reasons.push(`${uniqueContacts.size} contact(s), ${uniqueCompanies.size} compan${uniqueCompanies.size !== 1 ? 'ies' : 'y'}`)
  if (maxWeight > 1) reasons.push(`includes ${stages.find((s) => stageWeights[s] === maxWeight)} customer`)

  return { score, reasoning: reasons.join('; ') }
}

function formatCompact(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`
  return String(value)
}

/**
 * Compute blended impact score.
 *
 * Blend: technicalScore * 0.4 + customerScore * 0.6
 * When no technical score: customerScore only
 */
export function computeImpact(input: ImpactInput): ImpactResult {
  const { technicalImpactScore, sessions } = input

  const customer = computeCustomerScore(sessions)

  if (technicalImpactScore == null) {
    return {
      score: customer.score,
      reasoning: `Customer: ${customer.reasoning}`,
    }
  }

  const blended = technicalImpactScore * 0.4 + customer.score * 0.6
  const score = Math.min(5, Math.max(1, Math.round(blended)))

  return {
    score,
    reasoning: `Technical: ${technicalImpactScore}/5; Customer: ${customer.reasoning}`,
  }
}
