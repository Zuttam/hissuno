/**
 * Session Review Workflow
 *
 * Unified workflow for reviewing closed sessions. Performs:
 * 1. Classification - Tags the session with classification labels
 * 2. PM Review - Analyzes for actionable feedback and creates/upvotes issues
 *
 * Triggered automatically on session close or manually from the dashboard.
 */

import { createWorkflow } from '@mastra/core/workflows'
import { workflowInputSchema, workflowOutputSchema } from './schemas'
import { classifySession } from './steps/classify-session'
import { pmReview } from './steps/pm-review'

export const sessionReviewWorkflow = createWorkflow({
  id: 'session-review-workflow',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  .then(classifySession)
  .then(pmReview)

sessionReviewWorkflow.commit()

// Re-export schemas for external use
export * from './schemas'
