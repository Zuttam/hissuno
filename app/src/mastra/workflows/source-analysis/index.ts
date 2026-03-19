/**
 * Source Analysis Workflow
 *
 * Analyzes a single knowledge source independently:
 * 1. Fetch Content - Type-specific content fetching + AI extraction
 * 2. Sanitize Content - Security scanning per source
 * 3. Save and Embed - Store analyzed content + generate embeddings + cleanup
 * 4. Trigger Graph Eval - Async relationship discovery via graph-evaluation workflow
 */

import { createWorkflow } from '@mastra/core/workflows'
import { sourceAnalysisInputSchema, findRelationshipsOutputSchema } from './schemas'
import { fetchContent } from './steps/fetch-content'
import { sanitizeContent } from './steps/sanitize-content'
import { saveAndEmbed } from './steps/save-and-embed'
import { triggerGraphEval } from './steps/trigger-graph-eval'

export const sourceAnalysisWorkflow = createWorkflow({
  id: 'source-analysis-workflow',
  inputSchema: sourceAnalysisInputSchema,
  outputSchema: findRelationshipsOutputSchema,
})
  .then(fetchContent)
  .then(sanitizeContent)
  .then(saveAndEmbed)
  .then(triggerGraphEval)

sourceAnalysisWorkflow.commit()

export * from './schemas'
