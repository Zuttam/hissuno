/**
 * Spec Generation Workflow
 *
 * Generates a product specification for an issue using the Spec Writer agent
 * with access to codebase exploration tools and knowledge packages.
 *
 * Steps:
 * 1. Prepare Codebase - Acquires codebase lease and syncs if needed
 * 2. Prepare Context - Gathers issue details, linked sessions, and knowledge
 * 3. Generate Spec - Uses Spec Writer agent to create and save specification
 * 4. Cleanup Codebase - Releases codebase lease and cleans up if no other leases
 *
 * Triggered when an issue's upvote count reaches the spec threshold,
 * or manually from the issue detail view.
 */

import { createWorkflow } from '@mastra/core/workflows'
import { workflowInputSchema, workflowOutputSchema } from './schemas'
import { prepareCodebase } from './steps/prepare-codebase'
import { cleanupCodebase } from './steps/cleanup-codebase'
import { prepareContext } from './steps/prepare-context'
import { generateSpec } from './steps/generate-spec'

export const specGenerationWorkflow = createWorkflow({
  id: 'spec-generation-workflow',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  // Step 1: Prepare codebase access
  .then(prepareCodebase)
  // Step 2: Gather all context for spec generation
  .then(prepareContext)
  // Step 3: Generate and save the specification
  .then(generateSpec)
  // Step 4: Cleanup codebase lease
  .then(cleanupCodebase)

specGenerationWorkflow.commit()

// Re-export schemas for external use
export * from './schemas'
