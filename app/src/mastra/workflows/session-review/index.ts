/**
 * Session Review Workflow
 *
 * Multi-step workflow for reviewing closed sessions. Performs:
 * 1. Prepare Codebase - Acquires codebase lease and syncs if needed
 * 2. Classification - Tags the session with classification labels
 * 3. Prepare Context - Fetches session data, messages, and settings
 * 4. Find Duplicates - Semantic search for similar issues
 * 5. Analyze Technical Impact - Agent-based impact and effort analysis
 * 6. PM Decision - Agent decides: skip, create, or upvote
 * 7. Execute Decision - Creates/upvotes issue or marks as reviewed
 * 8. Cleanup Codebase - Releases codebase lease and cleans up if no other leases
 *
 * Triggered automatically on session close or manually from the dashboard.
 */

import { createWorkflow } from '@mastra/core/workflows'
import { workflowInputSchema, workflowOutputSchema } from './schemas'
import { prepareCodebase } from './steps/prepare-codebase'
import { cleanupCodebase } from './steps/cleanup-codebase'
import { classifySession } from './steps/classify-session'
import { preparePMContext } from './steps/prepare-pm-context'
import { findDuplicates } from './steps/find-duplicates'
import { analyzeTechnicalImpact } from './steps/analyze-technical-impact'
import { pmDecision } from './steps/pm-decision'
import { executeDecision } from './steps/execute-decision'

export const sessionReviewWorkflow = createWorkflow({
  id: 'session-review-workflow',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  // Step 1: Prepare codebase access
  .then(prepareCodebase)
  // Step 2: Classify session with tags
  .then(classifySession)
  // Step 3: Prepare PM context (fetch session, messages, settings)
  .then(preparePMContext)
  // Step 4: Find similar issues for deduplication
  .then(findDuplicates)
  // Step 5: Analyze technical impact and estimate effort
  .then(analyzeTechnicalImpact)
  // Step 6: PM agent makes decision
  .then(pmDecision)
  // Step 7: Execute the decision
  .then(executeDecision)
  // Step 8: Cleanup codebase lease
  .then(cleanupCodebase)

sessionReviewWorkflow.commit()

// Re-export schemas for external use
export * from './schemas'
