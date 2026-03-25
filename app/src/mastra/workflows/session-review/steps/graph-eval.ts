/**
 * Step: Graph Evaluation (Session Review Inline)
 *
 * Runs graph evaluation for the session, discovering product scopes
 * and related entities. Replaces the scope assignment that was previously
 * in classify-session.
 */

import { createStep } from '@mastra/core/workflows'
import { summarizeOutputSchema } from '../schemas'
import { evaluateEntityRelationships } from '../../graph-evaluation'

export const graphEvalSession = createStep({
  id: 'graph-eval-session',
  description: 'Discover product scope and related entities for the session',
  inputSchema: summarizeOutputSchema,
  outputSchema: summarizeOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    if (!inputData) throw new Error('Input data not found')

    const { sessionId, projectId } = inputData
    const logger = mastra?.getLogger()

    logger?.info('[graph-eval-session] Starting', { sessionId, projectId })
    await writer?.write({ type: 'progress', message: 'Discovering relationships...' })

    const result = await evaluateEntityRelationships(projectId, 'session', sessionId)

    if (result.errors.length > 0) {
      logger?.warn('[graph-eval-session] Errors during evaluation', { errors: result.errors })
    }

    logger?.info('[graph-eval-session] Completed', {
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
