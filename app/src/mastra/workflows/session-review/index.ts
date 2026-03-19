/**
 * Session Review Workflow
 *
 * Multi-step workflow for reviewing closed sessions. Performs:
 * 1. Classification - Tags the session with classification labels
 * 2. Summarize - Generates improved name and description
 * 3. Graph Eval - Discovers product scope + related entities
 * 4. Prepare Context - Fetches session data and settings
 * 5. Resolve Contact - Matches session to a contact by email (auto-creates if needed)
 * 6. Find Duplicates - Semantic search for similar issues
 * 7. PM Decision - Agent decides: skip, create, or upvote
 * 8. Execute Decision - Creates/upvotes issue or marks as reviewed
 *
 * Triggered automatically on session close or manually from the dashboard.
 */

import { createWorkflow } from '@mastra/core/workflows'
import { workflowInputSchema, workflowOutputSchema } from './schemas'
import { classifySession } from './steps/classify-session'
import { summarizeSession } from './steps/summarize-session'
import { graphEvalSession } from './steps/graph-eval'
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
  // Step 2: Summarize session (generate name + description)
  .then(summarizeSession)
  // Step 3: Discover product scope + related entities
  .then(graphEvalSession)
  // Step 4: Prepare PM context (fetch session data and settings)
  .then(preparePMContext)
  // Step 5: Resolve contact from user metadata (deterministic, no AI)
  .then(resolveContact)
  // Step 6: Find similar issues for deduplication
  .then(findDuplicates)
  // Step 7: PM agent makes decision
  .then(pmDecision)
  // Step 8: Execute the decision
  .then(executeDecision)

sessionReviewWorkflow.commit()

// Re-export schemas for external use
export * from './schemas'
