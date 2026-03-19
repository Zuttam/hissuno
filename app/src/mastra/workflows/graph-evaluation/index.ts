/**
 * Graph Evaluation Workflow
 *
 * Unified entity relationship discovery workflow.
 * Can be triggered:
 * - Inline: within session-review and issue-analysis workflows (synchronous)
 * - Async: for knowledge sources, contacts, and companies (fire-and-forget)
 */

import { createWorkflow } from '@mastra/core/workflows'
import type { Mastra } from '@mastra/core/mastra'
import { graphEvaluationInputSchema, graphEvaluationOutputSchema } from './schemas'
import type { GraphEvaluationOutput, GraphEntityType } from './schemas'
import { loadEntityContent } from './steps/load-entity-content'
import { extractTopics } from './steps/extract-topics'
import { discoverRelationships } from './steps/discover-relationships'
import { loadEntityContentFn } from './steps/load-entity-content'
import { extractTopicsFn } from './steps/extract-topics'
import { discoverRelationshipsFn } from './steps/discover-relationships'

export const graphEvaluationWorkflow = createWorkflow({
  id: 'graph-evaluation-workflow',
  inputSchema: graphEvaluationInputSchema,
  outputSchema: graphEvaluationOutputSchema,
})
  .then(loadEntityContent)
  .then(extractTopics)
  .then(discoverRelationships)

graphEvaluationWorkflow.commit()

/**
 * Run graph evaluation inline (synchronous). Used within session-review
 * and issue-analysis workflows where downstream steps need the results.
 */
export async function runGraphEvalInline(
  projectId: string,
  entityType: GraphEntityType,
  entityId: string,
): Promise<GraphEvaluationOutput> {
  try {
    // Step 1: Load entity content
    const content = await loadEntityContentFn(projectId, entityType, entityId)

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
    const topicsResult = await extractTopicsFn(
      content.contentForSearch,
      content.entityName,
      entityType,
      content.guidelines,
    )

    // Step 3: Discover relationships
    const discoveryResult = await discoverRelationshipsFn({
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

/**
 * Trigger graph evaluation asynchronously (fire-and-forget).
 * Used after knowledge source analysis, contact creation, and company creation.
 */
export async function triggerGraphEvaluation(
  mastra: Mastra | undefined,
  input: { projectId: string; entityType: GraphEntityType; entityId: string }
) {
  try {
    const workflow = mastra?.getWorkflow('graphEvaluationWorkflow')
    if (!workflow) return
    const run = await workflow.createRunAsync({
      runId: `graph-eval-${input.entityType}-${input.entityId}-${Date.now()}`,
    })
    void run.start({ inputData: input })
  } catch (err) {
    console.warn('[graph-evaluation] Failed to trigger', err)
  }
}

export * from './schemas'
