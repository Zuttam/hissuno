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

import type { GraphEvaluationOutput, GraphEntityType } from './schemas'
import { loadEntityContent } from './steps/load-entity-content'
import { extractTopics } from './steps/extract-topics'
import { discoverRelationships } from './steps/discover-relationships'

/**
 * Evaluate entity relationships synchronously. Returns discovered relationships
 * and product scope assignment.
 */
export async function evaluateEntityRelationships(
  projectId: string,
  entityType: GraphEntityType,
  entityId: string,
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
      }
    }

    // Step 2: Extract topics
    const topicsResult = await extractTopics(
      content.contentForSearch,
      content.entityName,
      entityType,
      content.guidelines,
    )

    // Step 3: Discover relationships
    const discoveryResult = await discoverRelationships({
      projectId,
      entityType,
      entityId,
      topics: topicsResult.topics,
      combinedQuery: topicsResult.combinedQuery,
      contentForTextMatch: content.contentForTextMatch,
    })

    return {
      projectId,
      entityType,
      entityId,
      ...discoveryResult,
    }
  } catch (err) {
    return {
      projectId,
      entityType,
      entityId,
      relationshipsCreated: 0,
      productScopeId: null,
      errors: [err instanceof Error ? err.message : 'Unknown error'],
    }
  }
}

export * from './schemas'
