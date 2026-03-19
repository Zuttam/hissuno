/**
 * Issue Analysis Workflow
 *
 * Computes reach, impact, confidence, and effort scores for an issue using a
 * combination of deterministic algorithms and AI-powered technical analysis,
 * then generates a product brief.
 *
 * Steps:
 * 1. Prepare Codebase - Acquires codebase lease and syncs if needed
 * 2. Prepare Context - Gathers issue details, linked sessions with customer
 *    data, and session timestamps
 * 3. Analyze Impact & Effort - Uses Technical Analyst agent to assess
 *    technical impact and implementation effort
 * 4. Compute Scores - Deterministic step that computes reach from
 *    timestamps, blends impact scores, maps effort, calculates priority,
 *    and persists results to the database
 * 5. Generate Brief - Uses Brief Writer agent to produce a product brief
 * 6. Cleanup Codebase - Releases codebase lease and cleans up if no other
 *    leases remain
 *
 * Triggered after an issue is created or upvoted, or manually from the
 * issue detail view.
 */

import { createWorkflow } from '@mastra/core/workflows'
import { workflowInputSchema, workflowOutputSchema } from './schemas'
import { prepareCodebase } from './steps/prepare-codebase'
import { cleanupCodebase } from './steps/cleanup-codebase'
import { prepareContext } from './steps/prepare-context'
import { graphEvalIssue } from './steps/graph-eval'
import { analyzeImpactEffort } from './steps/analyze-impact-effort'
import { computeScores } from './steps/compute-scores'
import { generateBrief } from './steps/generate-brief'

export const issueAnalysisWorkflow = createWorkflow({
  id: 'issue-analysis-workflow',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  // Step 1: Prepare codebase access
  .then(prepareCodebase)
  // Step 2: Gather all context for analysis
  .then(prepareContext)
  // Step 3: Discover product scope + related entities
  .then(graphEvalIssue)
  // Step 4: Analyze technical impact and effort using AI agent
  .then(analyzeImpactEffort)
  // Step 5: Compute deterministic scores and persist to DB
  .then(computeScores)
  // Step 6: Generate product brief
  .then(generateBrief)
  // Step 7: Cleanup codebase lease
  .then(cleanupCodebase)

issueAnalysisWorkflow.commit()

// Re-export schemas for external use
export * from './schemas'
