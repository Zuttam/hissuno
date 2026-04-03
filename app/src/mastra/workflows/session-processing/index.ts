/**
 * Session Processing Workflow
 *
 * Performs all processing for closed sessions:
 * 1. Classification - Tags the session with classification labels
 * 2. Summarize - Generates improved name and description + embedding
 * 3. Graph Eval - Discovers relationships + runs creation policies
 *    (contact resolution, issue creation/linking)
 * 4. Mark Processed - Sets base_processed_at
 *
 * Triggered automatically by cron or manually from the dashboard.
 */

import { createWorkflow } from '@mastra/core/workflows'
import { workflowInputSchema, workflowOutputSchema } from './schemas'
import { classifySession } from './steps/classify-session'
import { summarizeSession } from './steps/summarize-session'
import { graphEvalSession } from './steps/graph-eval'
import { markProcessed } from './steps/mark-processed'

export const sessionProcessingWorkflow = createWorkflow({
  id: 'session-processing-workflow',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  // Step 1: Classify session with tags
  .then(classifySession)
  // Step 2: Summarize session (generate name + description + embedding)
  .then(summarizeSession)
  // Step 3: Graph eval with creation policies (contact resolution + issue creation)
  .then(graphEvalSession)
  // Step 4: Mark session as fully processed
  .then(markProcessed)

sessionProcessingWorkflow.commit()

// Re-export schemas for external use
export * from './schemas'
