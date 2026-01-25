/**
 * Step: Prepare Codebase (Spec Generation Workflow)
 *
 * Workflow-specific step that acquires codebase access using the shared logic.
 * This step has schemas compatible with the spec-generation workflow.
 */

import { createStep } from '@mastra/core/workflows'
import { workflowInputSchema, workflowContextWithCodebaseSchema } from '../schemas'
import { prepareCodebaseForWorkflow } from '../../common/prepare-codebase'

export const prepareCodebase = createStep({
  id: 'prepare-codebase',
  description: 'Acquire codebase lease and sync if needed',
  inputSchema: workflowInputSchema,
  outputSchema: workflowContextWithCodebaseSchema,
  execute: async ({ inputData, mastra, writer, runId }) => {
    if (!inputData) {
      throw new Error('Input data not found')
    }

    const logger = mastra?.getLogger()
    const result = await prepareCodebaseForWorkflow({
      projectId: inputData.projectId,
      runId: inputData.runId, // Use the runId from input for spec generation
      logger: logger ? {
        info: (msg, data) => logger.info(msg, data),
        warn: (msg, data) => logger.warn(msg, data),
        error: (msg, data) => logger.error(msg, data),
      } : undefined,
      writer: writer ? {
        write: async (data) => { await writer.write(data) },
      } : undefined,
    })

    return {
      ...inputData,
      localCodePath: result.localCodePath,
      codebaseLeaseId: result.codebaseLeaseId,
      codebaseCommitSha: result.codebaseCommitSha,
    }
  },
})
