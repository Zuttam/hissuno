/**
 * Knowledge Analysis Workflow
 *
 * Analyzes project knowledge sources (codebase, websites, docs) and compiles
 * them into categorized knowledge packages for the support agent.
 *
 * Steps:
 * 1. Prepare Codebase - Acquires codebase lease and syncs if needed
 * 2. Analyze Codebase - Uses agent with tools to explore source code
 * 3. Analyze Sources - Fetches and analyzes websites, docs, and other sources
 * 4. Compile Knowledge - Categorizes findings into business, product, and technical
 * 5. Sanitize Knowledge - Scans and redacts sensitive information from knowledge packages
 * 6. Save Packages - Persists knowledge packages to storage and database
 * 7. Embed Knowledge - Generates vector embeddings for semantic search
 * 8. Cleanup Codebase - Releases codebase lease and cleans up if no other leases
 */

import { createWorkflow } from '@mastra/core/workflows'
import { workflowInputSchema, workflowWithEmbeddingOutputSchema } from './schemas'
import { prepareCodebase } from './steps/prepare-codebase'
import { cleanupCodebase } from './steps/cleanup-codebase'
import { analyzeCodebase } from './steps/analyze-codebase'
import { analyzeSources } from './steps/analyze-sources'
import { compileKnowledge } from './steps/compile-knowledge'
import { sanitizeKnowledge } from './steps/sanitize-knowledge'
import { saveKnowledgePackages } from './steps/save-packages'
import { embedKnowledge } from './steps/embed-knowledge'

export const knowledgeAnalysisWorkflow = createWorkflow({
  id: 'knowledge-analysis-workflow',
  inputSchema: workflowInputSchema,
  outputSchema: workflowWithEmbeddingOutputSchema,
})
  .then(prepareCodebase)
  .then(analyzeCodebase)
  .then(analyzeSources)
  .then(compileKnowledge)
  .then(sanitizeKnowledge)
  .then(saveKnowledgePackages)
  .then(embedKnowledge)
  .then(cleanupCodebase)

knowledgeAnalysisWorkflow.commit()

// Re-export schemas for external use
export * from './schemas'
