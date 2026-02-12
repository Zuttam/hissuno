/**
 * Session Review Workflow
 *
 * Multi-step workflow for reviewing closed sessions. Performs:
 * 1. Classification - Tags the session with classification labels
 * 2. Prepare Context - Fetches session data, messages, and settings
 * 3. Resolve Contact - Matches session to a contact by email (auto-creates if needed)
 * 4. Find Duplicates - Semantic search for similar issues
 * 5. PM Decision - Agent decides: skip, create, or upvote
 * 6. Execute Decision - Creates/upvotes issue or marks as reviewed
 *
 * Triggered automatically on session close or manually from the dashboard.
 */

import { createWorkflow } from '@mastra/core/workflows'
import { workflowInputSchema, workflowOutputSchema } from './schemas'
import { classifySession } from './steps/classify-session'
import { preparePMContext } from './steps/prepare-pm-context'
import { resolveContact } from './steps/resolve-contact'
import { findDuplicates } from './steps/find-duplicates'
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
  // Step 3: Resolve contact from user metadata (deterministic, no AI)
  .then(resolveContact)
  // Step 4: Find similar issues for deduplication
  .then(findDuplicates)
  // Step 5: PM agent makes decision
  .then(pmDecision)
  // Step 6: Execute the decision
  .then(executeDecision)

sessionReviewWorkflow.commit()

// Re-export schemas for external use
export * from './schemas'
