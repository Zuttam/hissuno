/**
 * Graph Evaluation - Entity Relationship Discovery
 *
 * Discovers relationships between entities (sessions, issues, knowledge sources,
 * contacts, companies) by extracting topics and running semantic + text matching.
 *
 * Usage:
 * - Inline: `await evaluateEntityRelationships(projectId, entityType, entityId)`
 * - Fire-and-forget: `fireGraphEval(projectId, entityType, entityId)` from `@/lib/utils/graph-eval`
 */

import type { GraphEvaluationOutput, GraphEntityType, CreationContext } from './schemas'
import { loadEntityContent } from './steps/load-entity-content'
import { extractTopics } from './steps/extract-topics'
import { discoverRelationships } from './steps/discover-relationships'

/**
 * Evaluate entity relationships synchronously. Returns discovered relationships,
 * product scope assignment, and optional creation policy results.
 *
 * @param creationContext - When provided and entityType is 'session', runs Phase 2
 *   creation policies (contact + issue creation) after relationship discovery.
 */
export async function evaluateEntityRelationships(
  projectId: string,
  entityType: GraphEntityType,
  entityId: string,
  creationContext?: CreationContext,
): Promise<GraphEvaluationOutput> {
  try {
    // Step 1: Load entity content
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

    // Step 2: Extract topics
    const topicsResult = await extractTopics(
      content.contentForSearch,
      content.entityName,
      entityType,
      content.guidelines,
      projectId,
    )

    // Step 3: Discover relationships
    const discoveryResult = await discoverRelationships({
      projectId,
      entityType,
      entityId,
      topics: topicsResult.topics,
      combinedQuery: topicsResult.combinedQuery,
      contentForTextMatch: content.contentForTextMatch,
      entityName: content.entityName,
      contentForSearch: content.contentForSearch,
    })

    // Phase 2: Creation policies (only for sessions with creationContext)
    let createdContactId: string | null = null
    let createdIssueIds: string[] = []
    let issueResults: Array<{ action: 'created' | 'linked' | 'skipped'; issueId: string | null; issueName: string | null }> = []
    let pmAction: 'created' | 'linked' | 'skipped' | null = null
    let pmSkipReason: string | null = null

    if (creationContext && entityType === 'session') {
      // Step 4: Contact creation policy
      try {
        const { runContactCreationPolicy } = await import('./steps/create-contact')
        const contactResult = await runContactCreationPolicy({
          projectId,
          sessionId: entityId,
          userMetadata: creationContext.userMetadata,
        })
        createdContactId = contactResult.contactId
      } catch (err) {
        discoveryResult.errors.push(`Contact creation failed: ${err instanceof Error ? err.message : 'Unknown'}`)
      }

      // Step 5: Issue creation policy (supports multiple issues)
      try {
        const { runIssueCreationPolicy, primaryAction } = await import('./steps/create-issue')
        const issueResult = await runIssueCreationPolicy({
          projectId,
          sessionId: entityId,
          tags: creationContext.tags,
          messages: creationContext.messages,
          productScopeId: discoveryResult.productScopeId,
          issueMatches: discoveryResult.issueMatches,
          productScopeContext: null,
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
