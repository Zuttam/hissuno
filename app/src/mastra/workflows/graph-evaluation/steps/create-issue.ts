/**
 * Issue Creation Policy
 *
 * Decides whether to create a new issue, link to an existing similar issue,
 * or skip based on session analysis. Absorbs the PM decision logic from
 * the former feedback analysis workflow.
 *
 * Runs as part of graph evaluation Phase 2 (creation policies).
 */

import { Agent } from '@mastra/core/agent'
import { resolveModel } from '@/mastra/models'
import { getAIModelSettingsAdmin } from '@/lib/db/queries/project-settings'

import type { IssueMatch } from './discover-relationships'
import type { GraphEvaluationConfig } from '../config'

export interface IssueCreationInput {
  projectId: string
  sessionId: string
  tags: string[]
  messages: { role: string; content: string; createdAt: string }[]
  productScopeId: string | null
  productScopeContext: {
    name: string
    description: string
    matchedGoalText: string | null
    reasoning: string | null
  } | null
  issueMatches: IssueMatch[]
  issueConfig: GraphEvaluationConfig['creation']['issues']
}

export interface IssueCreationResultEntry {
  action: 'created' | 'linked' | 'skipped'
  issueId: string | null
  issueName: string | null
  productScopeId: string | null
  skipReason: string | null
}

export interface IssueCreationResult {
  results: IssueCreationResultEntry[]
}

/** Compute the primary action from multi-issue results (created > linked > skipped) */
export function primaryAction(result: IssueCreationResult): 'created' | 'linked' | 'skipped' {
  if (result.results.some(r => r.action === 'created')) return 'created'
  if (result.results.some(r => r.action === 'linked')) return 'linked'
  return 'skipped'
}

/**
 * Run the issue creation policy for a session.
 * Returns multiple results - one per created/linked/skipped issue.
 */
export async function runIssueCreationPolicy(
  input: IssueCreationInput
): Promise<IssueCreationResult> {
  const { projectId, sessionId, tags, messages, productScopeId, issueMatches, issueConfig } = input
  const skipResult = (reason: string): IssueCreationResult => ({
    results: [{ action: 'skipped', issueId: null, issueName: null, productScopeId: null, skipReason: reason }],
  })

  // Gate: need at least one user message to analyze
  const hasUserMessage = messages.some(m => m.role === 'user')
  if (!hasUserMessage) return skipResult('No user messages to analyze')

  // Gate: no actionable tags
  const actionableTags = issueConfig.actionableTags
  const hasActionableTag = tags.some(t => actionableTags.includes(t))
  if (!hasActionableTag) return skipResult(`No actionable tags (${actionableTags.join(', ')})`)

  // Check for strong match - link to existing issue
  const bestMatch = issueMatches.length > 0
    ? issueMatches.reduce((best, m) => m.similarity > best.similarity ? m : best, issueMatches[0])
    : null

  if (bestMatch && bestMatch.similarity >= issueConfig.linkThreshold) {
    try {
      const { linkSessionToIssueAdmin } = await import('@/lib/issues/issues-service')
      await linkSessionToIssueAdmin(bestMatch.issueId, sessionId, projectId)
    } catch { /* duplicate link is fine */ }
    return {
      results: [{ action: 'linked', issueId: bestMatch.issueId, issueName: bestMatch.name, productScopeId: null, skipReason: null }],
    }
  }

  // No strong match - use PM agent to decide create or skip
  try {
    const decision = await makePMDecision(input)

    if (decision.action === 'skip') {
      return skipResult(decision.skipReason ?? 'PM agent decided to skip')
    }

    // Safety net: if PM says "create" but there's a moderate match, override to link
    if (decision.action === 'create' && bestMatch && bestMatch.similarity >= issueConfig.safetyNetThreshold) {
      try {
        const { linkSessionToIssueAdmin } = await import('@/lib/issues/issues-service')
        await linkSessionToIssueAdmin(bestMatch.issueId, sessionId, projectId)
      } catch { /* duplicate link is fine */ }
      return {
        results: [{ action: 'linked', issueId: bestMatch.issueId, issueName: bestMatch.name, productScopeId: null, skipReason: null }],
      }
    }

    if (decision.action === 'create' && decision.newIssues && decision.newIssues.length > 0) {
      const { createIssueAdmin } = await import('@/lib/issues/issues-service')
      const { matchProductScope } = await import('./discover-relationships')
      const results: IssueCreationResultEntry[] = []

      for (const newIssue of decision.newIssues) {
        try {
          // Per-issue scope evaluation based on the issue's own content
          const issueTopics = newIssue.name.toLowerCase().split(/\s+/).filter((w: string) => w.length > 3)
          const scopeMatch = await matchProductScope(projectId, issueTopics, newIssue.name, newIssue.description.slice(0, 1500))
          const issueScopeId = scopeMatch?.scopeId ?? productScopeId

          const { issue } = await createIssueAdmin({
            projectId,
            sessionId,
            type: newIssue.type,
            name: newIssue.name,
            description: newIssue.description,
            priority: newIssue.priority ?? 'low',
            productScopeId: issueScopeId,
          })

          results.push({
            action: 'created',
            issueId: issue.id,
            issueName: newIssue.name,
            productScopeId: issueScopeId,
            skipReason: null,
          })
        } catch (err) {
          results.push({
            action: 'skipped',
            issueId: null,
            issueName: newIssue.name,
            productScopeId: null,
            skipReason: `Creation failed: ${err instanceof Error ? err.message : 'Unknown'}`,
          })
        }
      }

      return { results }
    }

    return skipResult('PM agent returned invalid decision')
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    return skipResult(`PM decision error: ${message}`)
  }
}

// ---------------------------------------------------------------------------
// Internal: PM decision via inline LLM call
// ---------------------------------------------------------------------------

interface PMIssue {
  type: 'bug' | 'feature_request' | 'change_request'
  name: string
  description: string
  priority: 'low' | 'medium' | 'high'
}

interface PMDecision {
  action: 'skip' | 'create'
  skipReason?: string
  newIssues?: PMIssue[]
}

async function makePMDecision(
  input: IssueCreationInput
): Promise<PMDecision> {
  const { tags, messages, issueMatches, productScopeContext, issueConfig } = input

  // Build conversation summary
  const conversationSummary = messages
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content.slice(0, 500)}`)
    .join('\n\n')

  // Build similar issues summary
  const similarIssuesSummary = issueMatches.length > 0
    ? issueMatches
        .map((i) => `- [${Math.round(i.similarity * 100)}% match] ${i.name} (${i.status}, ${i.sessionCount} sessions)\n  ID: ${i.issueId}`)
        .join('\n')
    : 'No similar issues found.'

  // Build tag hints
  const tagHints = buildTagHints(tags)

  // Build scope section
  const scopeSection = productScopeContext
    ? `\n## Product Scope Context\nProduct scope: ${productScopeContext.name}\n${productScopeContext.description ? `Description: ${productScopeContext.description}` : ''}${productScopeContext.matchedGoalText ? `\nMatched goal: ${productScopeContext.matchedGoalText}` : ''}\n${productScopeContext.reasoning ? `Classification reasoning: ${productScopeContext.reasoning}` : ''}\n`
    : ''

  const prompt = `You are a Product Manager analyzing a customer support session. Make a decision based on the context below.

## Session Tags
${tags.length > 0 ? tags.join(', ') : 'No tags applied'}
${tagHints}

## Conversation
${conversationSummary}

## Similar Existing Issues
${similarIssuesSummary}

IMPORTANT: If ANY similar issue above has ${Math.round(issueConfig.safetyNetThreshold * 100)}% or higher similarity, you must NOT create a new issue covering the same problem. Instead, return SKIP with a reason explaining the overlap.
${scopeSection}
## Priority Guidelines
- **HIGH**: Regressions (something that used to work is now broken), complete feature loss, data loss/corruption risk, security issues, blocking many users
- **MEDIUM**: Partial breakage with workarounds, degraded functionality, inconsistent behavior, issues affecting a segment of users
- **LOW**: Edge cases, cosmetic issues, minor inconveniences, nice-to-have improvements

### Regression Detection
Look for these patterns in the conversation:
- Temporal references: "since last week", "after the update", "used to work", "recently broke", "was fine before"
- Explicit regression language: "regression", "broken again", "no longer works", "stopped working"
- If the conversation contains regression indicators, priority should be HIGH unless there is strong evidence otherwise.

## Your Decision

Based on the above, decide one of:

1. **SKIP** - If the session is:
   - A simple Q&A that was resolved
   - General positive feedback without actionable items
   - Off-topic or spam
   - Tags include only "wins" without other actionable tags

2. **CREATE** - If actionable feedback with no strong match (all similar issues below ${Math.round(issueConfig.linkThreshold * 100)}% similarity):
   - A session may contain MULTIPLE distinct problems. Create a SEPARATE issue for each.
   - Do NOT combine unrelated problems into a single issue.
   - For each issue provide: type, name, description with user quotes, priority
   - Suggest priority (low/medium/high) - see Priority Guidelines above. Default to HIGH for regressions.

Return ONLY a JSON object in this exact format:

For SKIP:
{"action": "skip", "skipReason": "Brief explanation"}

For CREATE (one or more issues):
{"action": "create", "newIssues": [{"type": "bug|feature_request|change_request", "name": "Issue name", "description": "Detailed description with quotes", "priority": "low|medium|high"}]}`

  const aiSettings = await getAIModelSettingsAdmin(input.projectId)
  const issuePolicyAgent = new Agent({
    id: 'issue-creation-policy',
    name: 'Issue Creation Policy',
    instructions: 'You decide whether to create new issues, link to existing ones, or skip, based on customer feedback analysis.',
    model: resolveModel(
      { name: 'issue-policy', tier: 'default', fallback: 'openai/gpt-5' },
      aiSettings,
    ),
  });
  const response = await issuePolicyAgent.generate(prompt)

  // Parse the response
  const text = response.text ?? ''
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    return { action: 'skip', skipReason: 'Unable to parse PM agent response' }
  }

  const parsed = JSON.parse(jsonMatch[0])

  if (parsed.action === 'skip') {
    return { action: 'skip', skipReason: parsed.skipReason ?? 'No actionable feedback' }
  }

  if (parsed.action === 'create') {
    // Normalize: accept both newIssues (array) and newIssue (singular) from LLM
    const rawIssues: PMIssue[] = parsed.newIssues
      ?? (parsed.newIssue ? [parsed.newIssue] : [])
    const newIssues = rawIssues
      .filter((i: PMIssue) => i.name && i.description && i.type)
      .map((i: PMIssue) => ({
        type: i.type,
        name: i.name,
        description: i.description,
        priority: i.priority ?? 'low',
      }))
    if (newIssues.length > 0) {
      return { action: 'create', newIssues }
    }
  }

  return { action: 'skip', skipReason: 'Invalid PM agent response format' }
}

/**
 * Build hints based on session tags to guide the PM agent
 */
function buildTagHints(tags: string[]): string {
  const hints: string[] = []
  if (tags.includes('bug')) hints.push('- "bug" tag suggests this is a technical issue -> likely CREATE with type=bug. Check conversation for regression indicators (temporal references like "since last week", "used to work"). Regressions should be HIGH priority.')
  if (tags.includes('feature_request')) hints.push('- "feature_request" tag suggests new functionality -> likely CREATE with type=feature_request')
  if (tags.includes('change_request')) hints.push('- "change_request" tag suggests UX improvement -> likely CREATE with type=change_request')
  if (tags.includes('losses')) hints.push('- "losses" tag indicates user frustration -> consider higher priority')
  if (tags.includes('wins') && !tags.includes('bug') && !tags.includes('feature_request')) hints.push('- "wins" tag without actionable tags -> likely SKIP')
  if (tags.includes('general_feedback')) hints.push('- "general_feedback" usually means no specific issue -> evaluate carefully')
  return hints.length > 0 ? '\n### Tag Hints\n' + hints.join('\n') : ''
}

