/**
 * Step: Cleanup Codebase (Knowledge Analysis Workflow)
 *
 * Workflow-specific step that releases the codebase lease using the shared logic.
 * This step has schemas compatible with the knowledge-analysis workflow.
 */

import { createStep } from '@mastra/core/workflows'
import { workflowWithEmbeddingOutputSchema } from '../schemas'
import { cleanupCodebaseForWorkflow } from '../../common/cleanup-codebase'

// Input comes from embedKnowledge, which has the same shape
const cleanupInputSchema = workflowWithEmbeddingOutputSchema

export const cleanupCodebase = createStep({
  id: 'cleanup-codebase',
  description: 'Release codebase lease and cleanup if no other leases remain',
  inputSchema: cleanupInputSchema,
  outputSchema: workflowWithEmbeddingOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    if (!inputData) {
      throw new Error('Input data not found')
    }

    const logger = mastra?.getLogger()
    const leaseId = inputData.codebaseLeaseId

    // If no lease ID, nothing to clean up
    if (!leaseId) {
      return {
        ...inputData,
        codebaseCleanedUp: false,
      }
    }

    const success = await cleanupCodebaseForWorkflow({
      codebaseLeaseId: leaseId,
      logger: logger ? {
        info: (msg, data) => logger.info(msg, data),
        warn: (msg, data) => logger.warn(msg, data),
      } : undefined,
      writer: writer ? {
        write: async (data) => { await writer.write(data) },
      } : undefined,
    })

    return {
      ...inputData,
      codebaseCleanedUp: success,
    }
  },
})
