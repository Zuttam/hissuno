/**
 * Graph Evaluation - Entity Relationship Discovery
 *
 * Discovers relationships between entities (sessions, issues, knowledge sources,
 * contacts, companies) by extracting topics and running semantic + text matching.
 *
 * Usage:
 * - Inline: `await evaluateEntityRelationships(projectId, entityType, entityId, creationContext, config)`
 * - Fire-and-forget: `fireGraphEval(projectId, entityType, entityId)` from `@/lib/utils/graph-eval`
 */

import type { GraphEvaluationOutput, GraphEntityType, CreationContext } from './schemas'
import { loadEntityContent } from './steps/load-entity-content'
import { extractTopics } from './steps/extract-topics'
import { discoverRelationships } from './steps/discover-relationships'
import { runContactCreationPolicy } from './steps/create-contact'
import { runIssueCreationPolicy, primaryAction } from './steps/create-issue'
import { DEFAULT_GRAPH_EVAL_CONFIG, type GraphEvaluationConfig } from './config'
import { getGraphEvaluationSettingsAdmin } from '@/lib/db/queries/graph-evaluation-settings'

/**
 * Evaluate entity relationships synchronously. Returns discovered relationships,
 * product scope assignment, and optional creation policy results.
 *
 * @param creationContext - When provided and entityType is 'session', Phase 2
 *   (contact + issue creation) may run based on per-entity flags in `config`.
 * @param config - Optional pre-fetched config; when omitted it's loaded from DB.
 */
export async function evaluateEntityRelationships(
  projectId: string,
  entityType: GraphEntityType,
  entityId: string,
  creationContext?: CreationContext,
  config?: GraphEvaluationConfig,
): Promise<GraphEvaluationOutput> {
  try {
    const resolvedConfig = config ?? (await getGraphEvaluationSettingsAdmin(projectId))

    const content = await loadEntityContent(projectId, entityType, entityId)

    if (!content.contentForSearch && !content.contentForTextMatch) {
      return {
        projectId,
        entityType,
        entityId,
        relationshipsCreated: 0,
        productScopeId: null,
        errors: [],
        createdContactId: null,
        createdIssueIds: [],
        issueResults: [],
        pmAction: null,
        pmSkipReason: null,
      }
    }

    const topicsResult = await extractTopics(
      content.contentForSearch,
      content.entityName,
      entityType,
      content.guidelines,
      projectId,
    )

    const discoveryResult = await discoverRelationships({
      projectId,
      entityType,
      entityId,
      topics: topicsResult.topics,
      combinedQuery: topicsResult.combinedQuery,
      contentForTextMatch: content.contentForTextMatch,
      entityName: content.entityName,
      contentForSearch: content.contentForSearch,
      config: resolvedConfig,
    })

    // Phase 2: Creation policies (only for sessions with creationContext)
    let createdContactId: string | null = null
    let createdIssueIds: string[] = []
    let issueResults: Array<{ action: 'created' | 'linked' | 'skipped'; issueId: string | null; issueName: string | null }> = []
    let pmAction: 'created' | 'linked' | 'skipped' | null = null
    let pmSkipReason: string | null = null

    if (creationContext && entityType === 'session') {
      if (resolvedConfig.creation.contacts.enabled) {
        try {
          const contactResult = await runContactCreationPolicy({
            projectId,
            sessionId: entityId,
            userMetadata: creationContext.userMetadata,
          })
          createdContactId = contactResult.contactId
        } catch (err) {
          discoveryResult.errors.push(`Contact creation failed: ${err instanceof Error ? err.message : 'Unknown'}`)
        }
      }

      if (resolvedConfig.creation.issues.enabled) {
        try {
          const issueResult = await runIssueCreationPolicy({
            projectId,
            sessionId: entityId,
            tags: creationContext.tags,
            messages: creationContext.messages,
            productScopeId: discoveryResult.productScopeId,
            issueMatches: discoveryResult.issueMatches,
            productScopeContext: null,
            issueConfig: resolvedConfig.creation.issues,
          })
          createdIssueIds = issueResult.results
            .filter(r => r.action === 'created' && r.issueId)
            .map(r => r.issueId!)
          issueResults = issueResult.results
            .filter(r => r.action !== 'skipped')
            .map(r => ({ action: r.action, issueId: r.issueId, issueName: r.issueName }))
          pmAction = primaryAction(issueResult)
          pmSkipReason = issueResult.results.every(r => r.action === 'skipped')
            ? issueResult.results[0]?.skipReason ?? null
            : null
        } catch (err) {
          discoveryResult.errors.push(`Issue creation failed: ${err instanceof Error ? err.message : 'Unknown'}`)
        }
      }
    }

    return {
      projectId,
      entityType,
      entityId,
      relationshipsCreated: discoveryResult.relationshipsCreated,
      productScopeId: discoveryResult.productScopeId,
      errors: discoveryResult.errors,
      createdContactId,
      createdIssueIds,
      issueResults,
      pmAction,
      pmSkipReason,
    }
  } catch (err) {
    return {
      projectId,
      entityType,
      entityId,
      relationshipsCreated: 0,
      productScopeId: null,
      errors: [err instanceof Error ? err.message : 'Unknown error'],
      createdContactId: null,
      createdIssueIds: [],
      issueResults: [],
      pmAction: null,
      pmSkipReason: null,
    }
  }
}

export * from './schemas'
export * from './config'
