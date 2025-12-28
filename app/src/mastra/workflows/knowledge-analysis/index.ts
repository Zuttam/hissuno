/**
 * Knowledge Analysis Workflow
 *
 * Analyzes project knowledge sources (codebase, websites, docs) and compiles
 * them into categorized knowledge packages for the support agent.
 *
 * Steps:
 * 1. Analyze Codebase - Uses agent with tools to explore source code in Supabase Storage
 * 2. Analyze Sources - Fetches and analyzes websites, docs, and other sources
 * 3. Compile Knowledge - Categorizes findings into business, product, and technical
 * 4. Sanitize Knowledge - Scans and redacts sensitive information from knowledge packages
 * 5. Save Packages - Persists knowledge packages to storage and database
 */

import { createWorkflow } from '@mastra/core/workflows'
import { workflowInputSchema, workflowOutputSchema } from './schemas'
import { analyzeCodebase } from './steps/analyze-codebase'
import { analyzeSources } from './steps/analyze-sources'
import { compileKnowledge } from './steps/compile-knowledge'
import { sanitizeKnowledge } from './steps/sanitize-knowledge'
import { saveKnowledgePackages } from './steps/save-packages'

export const knowledgeAnalysisWorkflow = createWorkflow({
  id: 'knowledge-analysis-workflow',
  inputSchema: workflowInputSchema,
  outputSchema: workflowOutputSchema,
})
  .then(analyzeCodebase)
  .then(analyzeSources)
  .then(compileKnowledge)
  .then(sanitizeKnowledge)
  .then(saveKnowledgePackages)

knowledgeAnalysisWorkflow.commit()

// Re-export schemas for external use
export * from './schemas'
