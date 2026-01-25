/**
 * Step: Cleanup Codebase (Session Review Workflow)
 *
 * Workflow-specific step that releases the codebase lease using the shared logic.
 * This step has schemas compatible with the session-review workflow.
 */

import { createStep } from '@mastra/core/workflows'
import { executeDecisionOutputSchema, workflowOutputSchema } from '../schemas'
import { cleanupCodebaseForWorkflow } from '../../common/cleanup-codebase'

export const cleanupCodebase = createStep({
  id: 'cleanup-codebase',
  description: 'Release codebase lease and cleanup if no other leases remain',
  inputSchema: executeDecisionOutputSchema,
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
        // forceCleanup defaults to false - cleanup is deferred to allow sequential workflows to reuse codebase
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
      tags: inputData.tags,
      tagsApplied: inputData.tagsApplied,
      action: inputData.action,
      issueId: inputData.issueId,
      issueTitle: inputData.issueTitle,
      skipReason: inputData.skipReason,
      thresholdMet: inputData.thresholdMet,
      specGenerated: inputData.specGenerated,
      impactScore: inputData.impactScore,
      effortEstimate: inputData.effortEstimate,
      codebaseLeaseId: leaseId,
      codebaseCleanedUp,
    }
  },
})
