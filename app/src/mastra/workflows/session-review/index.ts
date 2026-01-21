/**
 * Session Review Workflow
 *
 * Multi-step workflow for reviewing closed sessions. Performs:
 * 1. Classification - Tags the session with classification labels
 * 2. Prepare Context - Fetches session data, messages, and settings
 * 3. Find Duplicates - Semantic search for similar issues
 * 4. Analyze Impact - Identifies affected system areas
 * 5. Estimate Effort - Estimates implementation complexity
 * 6. PM Decision - Agent decides: skip, create, or upvote
 * 7. Execute Decision - Creates/upvotes issue or marks as reviewed
 *
 * Triggered automatically on session close or manually from the dashboard.
 */

import { createWorkflow } from '@mastra/core/workflows'
import { workflowInputSchema, workflowOutputSchema } from './schemas'
import { classifySession } from './steps/classify-session'
import { preparePMContext } from './steps/prepare-pm-context'
import { findDuplicates } from './steps/find-duplicates'
import { analyzeImpact } from './steps/analyze-impact'
import { estimateEffort } from './steps/estimate-effort'
import { pmDecision } from './steps/pm-decision'
import { executeDecision } from './steps/execute-decision'

export const sessionReviewWorkflow = createWorkflow({
  id: 'session-review-workflow',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  // Step 1: Classify session with tags
  .then(classifySession)
  // Step 2: Prepare PM context (fetch session, messages, settings)
  .then(preparePMContext)
  // Step 3: Find similar issues for deduplication
  .then(findDuplicates)
  // Step 4: Analyze system impact
  .then(analyzeImpact)
  // Step 5: Estimate implementation effort
  .then(estimateEffort)
  // Step 6: PM agent makes decision
  .then(pmDecision)
  // Step 7: Execute the decision
  .then(executeDecision)

sessionReviewWorkflow.commit()

// Re-export schemas for external use
export * from './schemas'
