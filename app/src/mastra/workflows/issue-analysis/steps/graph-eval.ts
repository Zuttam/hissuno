/**
 * Step: Graph Evaluation (Issue Analysis Inline)
 *
 * Runs graph evaluation for the issue, discovering product scopes
 * and related entities. Replaces scope assignment from analyze-impact-effort.
 */

import { createStep } from '@mastra/core/workflows'
import { preparedContextSchema, graphEvalContextSchema } from '../schemas'
import { runGraphEvalInline } from '../../graph-evaluation'

export const graphEvalIssue = createStep({
  id: 'graph-eval-issue',
  description: 'Discover product scope and related entities for the issue',
  inputSchema: preparedContextSchema,
  outputSchema: graphEvalContextSchema,
  execute: async ({ inputData, mastra, writer }) => {
    if (!inputData) throw new Error('Input data not found')

    const { issueId, projectId } = inputData
    const logger = mastra?.getLogger()

    logger?.info('[graph-eval-issue] Starting', { issueId, projectId })
    await writer?.write({ type: 'progress', message: 'Discovering relationships...' })

    const result = await runGraphEvalInline(projectId, 'issue', issueId)

    if (result.errors.length > 0) {
      logger?.warn('[graph-eval-issue] Errors during evaluation', { errors: result.errors })
    }

    logger?.info('[graph-eval-issue] Completed', {
      relationshipsCreated: result.relationshipsCreated,
      productScopeId: result.productScopeId,
    })

    await writer?.write({
      type: 'progress',
      message: `Found ${result.relationshipsCreated} relationships${result.productScopeId ? ' + product scope' : ''}`,
    })

    return {
      ...inputData,
      productScopeId: result.productScopeId,
    }
  },
})
