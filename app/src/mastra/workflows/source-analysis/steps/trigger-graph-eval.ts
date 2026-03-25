/**
 * Step 4: Trigger Graph Evaluation (Async)
 *
 * Fire-and-forget trigger for the graph evaluation workflow.
 * Replaces the synchronous find-relationships step with an async approach.
 */

import { createStep } from '@mastra/core/workflows'
import { evaluateEntityRelationships } from '../../graph-evaluation'
import { sourceAnalysisOutputSchema, findRelationshipsOutputSchema } from '../schemas'

export const triggerGraphEval = createStep({
  id: 'trigger-graph-eval',
  description: 'Run graph evaluation for entity relationship discovery',
  inputSchema: sourceAnalysisOutputSchema,
  outputSchema: findRelationshipsOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    if (!inputData) throw new Error('Input data not found')

    const { projectId, sourceId } = inputData
    const logger = mastra?.getLogger()

    logger?.info('[trigger-graph-eval] Starting graph evaluation', { sourceId })
    await writer?.write({ type: 'progress', message: 'Discovering relationships...' })

    const result = await evaluateEntityRelationships(projectId, 'knowledge_source', sourceId)

    if (result.errors.length > 0) {
      logger?.warn('[trigger-graph-eval] Errors during evaluation', { errors: result.errors })
    }

    await writer?.write({
      type: 'progress',
      message: `Found ${result.relationshipsCreated} relationships${result.productScopeId ? ' + product scope' : ''}`,
    })

    return { ...inputData, relationshipsCreated: result.relationshipsCreated }
  },
})
