/**
 * Step: Cleanup Codebase (Spec Generation Workflow)
 *
 * Workflow-specific step that releases the codebase lease using the shared logic.
 * This step has schemas compatible with the spec-generation workflow.
 */

import { createStep } from '@mastra/core/workflows'
import { generateSpecOutputSchema, workflowOutputSchema } from '../schemas'
import { cleanupCodebaseForWorkflow } from '../../common/cleanup-codebase'

export const cleanupCodebase = createStep({
  id: 'cleanup-codebase',
  description: 'Release codebase lease and cleanup if no other leases remain',
  inputSchema: generateSpecOutputSchema,
  outputSchema: workflowOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    if (!inputData) {
      throw new Error('Input data not found')
    }

    const logger = mastra?.getLogger()
    const leaseId = inputData.codebaseLeaseId

    let codebaseCleanedUp = false
    if (leaseId) {
      codebaseCleanedUp = await cleanupCodebaseForWorkflow({
        codebaseLeaseId: leaseId,
        logger: logger ? {
          info: (msg, data) => logger.info(msg, data),
          warn: (msg, data) => logger.warn(msg, data),
        } : undefined,
        writer: writer ? {
          write: async (data) => { await writer.write(data) },
        } : undefined,
      })
    }

    // Return workflow output format
    return {
      issueId: inputData.issueId,
      projectId: inputData.projectId,
      success: inputData.specSaved,
      specGenerated: inputData.specSaved,
      error: inputData.error,
      codebaseLeaseId: leaseId,
      codebaseCleanedUp,
    }
  },
})
