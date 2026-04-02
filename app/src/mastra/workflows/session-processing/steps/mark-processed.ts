/**
 * Step: Mark Processed
 *
 * Final step of the session processing workflow. Sets base_processed_at
 * to indicate that all processing (classify, summarize, graph eval with
 * creation policies) has completed.
 */

import { createStep } from '@mastra/core/workflows'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { sessions } from '@/lib/db/schema/app'
import { graphEvalOutputSchema, workflowOutputSchema } from '../schemas'

export const markProcessed = createStep({
  id: 'mark-processed',
  description: 'Mark session as fully processed',
  inputSchema: graphEvalOutputSchema,
  outputSchema: workflowOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    if (!inputData) throw new Error('Input data not found')

    const { sessionId, projectId, tags, tagsApplied, name, description, productScopeId, pmAction, createdIssueIds } = inputData
    const logger = mastra?.getLogger()

    logger?.info('[mark-processed] Setting base_processed_at', { sessionId })

    const now = new Date()
    await db
      .update(sessions)
      .set({
        base_processed_at: now,
      })
      .where(eq(sessions.id, sessionId))

    await writer?.write({ type: 'progress', message: 'Processing complete' })

    return {
      sessionId,
      projectId,
      tags,
      tagsApplied,
      name,
      description,
      productScopeId,
      pmAction,
      createdIssueIds,
    }
  },
})
