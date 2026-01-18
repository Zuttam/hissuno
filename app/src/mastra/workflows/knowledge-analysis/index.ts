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
 * 6. Embed Knowledge - Generates vector embeddings for semantic search
 */

import { createWorkflow } from '@mastra/core/workflows'
import { workflowInputSchema, workflowWithEmbeddingOutputSchema } from './schemas'
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
  .then(analyzeCodebase)
  .then(analyzeSources)
  .then(compileKnowledge)
  .then(sanitizeKnowledge)
  .then(saveKnowledgePackages)
  .then(embedKnowledge)

knowledgeAnalysisWorkflow.commit()

// Re-export schemas for external use
export * from './schemas'
