/**
 * Step 4: Trigger Graph Evaluation (Async)
 *
 * Fire-and-forget trigger for the graph evaluation workflow.
 * Replaces the synchronous find-relationships step with an async approach.
 */

import { createStep } from '@mastra/core/workflows'
import { triggerGraphEvaluation } from '../../graph-evaluation'
import { sourceAnalysisOutputSchema, findRelationshipsOutputSchema } from '../schemas'

export const triggerGraphEval = createStep({
  id: 'trigger-graph-eval',
  description: 'Trigger async graph evaluation for entity relationship discovery',
  inputSchema: sourceAnalysisOutputSchema,
  outputSchema: findRelationshipsOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    if (!inputData) throw new Error('Input data not found')

    const { projectId, sourceId } = inputData
    const logger = mastra?.getLogger()

    logger?.info('[trigger-graph-eval] Triggering async graph evaluation', { sourceId })
    await writer?.write({ type: 'progress', message: 'Triggering relationship discovery...' })

    void triggerGraphEvaluation(mastra, {
      projectId,
      entityType: 'knowledge_source',
      entityId: sourceId,
    })

    await writer?.write({ type: 'progress', message: 'Relationship discovery triggered (async)' })

    return { ...inputData, relationshipsCreated: 0 }
  },
})
