/**
 * Relationship Metadata Types & Builder Functions
 *
 * Every entity relationship stores structured metadata explaining WHY the
 * connection exists. This enables both humans browsing the UI and agents
 * traversing the graph to understand relationship context without having
 * to open both entities and reverse-engineer the connection.
 *
 * Metadata is template-generated from data already available during graph
 * evaluation (similarity scores, topics, entity names) - no extra LLM calls.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SemanticMetadata {
  strategy: 'semantic'
  context: string
  similarity: number
  topics: string[]
  targetName?: string
}

export interface TextMatchMetadata {
  strategy: 'text_match'
  context: string
  matchType: 'name' | 'domain'
  matchedValue: string
}

export interface ProductScopeMetadata {
  strategy: 'product_scope'
  context: string
  topics: string[]
  matchedGoalId: string | null
  matchedGoalText: string | null
  reasoning: string | null
}

export interface ManualMetadata {
  strategy: 'manual'
  context: string
}

export interface ProgrammaticMetadata {
  strategy: 'programmatic'
  context: string
  source: string
}

export type RelationshipMetadata =
  | SemanticMetadata
  | TextMatchMetadata
  | ProductScopeMetadata
  | ManualMetadata
  | ProgrammaticMetadata

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

export function buildSemanticContext(opts: {
  similarity: number
  topics: string[]
  targetName?: string
}): SemanticMetadata {
  const pct = Math.round(opts.similarity * 100)
  const topicStr = opts.topics.slice(0, 3).join(', ')
  const target = opts.targetName ? ` with "${opts.targetName}"` : ''
  return {
    strategy: 'semantic',
    context: `Semantic match (${pct}%)${target} on topics: ${topicStr}`,
    similarity: opts.similarity,
    topics: opts.topics,
    targetName: opts.targetName,
  }
}

export function buildTextMatchContext(opts: {
  matchType: 'name' | 'domain'
  matchedValue: string
}): TextMatchMetadata {
  const label = opts.matchType === 'name' ? 'Company name' : 'Domain'
  return {
    strategy: 'text_match',
    context: `${label} "${opts.matchedValue}" found in content`,
    matchType: opts.matchType,
    matchedValue: opts.matchedValue,
  }
}

export function buildProductScopeContext(opts: {
  scopeName: string
  topics: string[]
  matchedGoalId: string | null
  matchedGoalText: string | null
  reasoning: string | null
}): ProductScopeMetadata {
  const goalPart = opts.matchedGoalText
    ? ` - Relates to: ${opts.matchedGoalText}`
    : ''
  return {
    strategy: 'product_scope',
    context: `Matched to ${opts.scopeName} scope${goalPart}`,
    topics: opts.topics,
    matchedGoalId: opts.matchedGoalId,
    matchedGoalText: opts.matchedGoalText,
    reasoning: opts.reasoning,
  }
}

export function buildManualContext(): ManualMetadata {
  return {
    strategy: 'manual',
    context: 'Linked manually',
  }
}

const SOURCE_LABELS: Record<string, string> = {
  'session-creation': 'Linked during session creation',
  'admin-link': 'Linked by admin',
  'issue-link': 'Linked during issue creation',
  'demo-data': 'Linked during demo data setup',
  'feedback-triage': 'Linked during feedback triage',
}

export function buildProgrammaticContext(source: string): ProgrammaticMetadata {
  return {
    strategy: 'programmatic',
    context: SOURCE_LABELS[source] ?? `Linked programmatically (${source})`,
    source,
  }
}
