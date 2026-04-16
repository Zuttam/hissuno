/**
 * Shared Zod schemas for the Package Compilation Workflow
 */

import { z } from 'zod'

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const sourceInputSchema = z.object({
  id: z.string(),
  type: z.enum(['website', 'docs_portal', 'uploaded_doc', 'raw_text', 'codebase']),
  url: z.string().nullable(),
  storagePath: z.string().nullable(),
  content: z.string().nullable(),
})

export type SourceInput = z.infer<typeof sourceInputSchema>

/**
 * Workflow input schema - projectId and sources.
 * Per-source analysis is delegated to analyzeSource() in knowledge-service.
 * After all sources are analyzed, the package is compiled if packageId is provided.
 */
export const workflowInputSchema = z.object({
  projectId: z.string(),
  packageId: z.string().nullable(),
  analysisScope: z.string().nullable(),
  sources: z.array(sourceInputSchema),
})

export type WorkflowInput = z.infer<typeof workflowInputSchema>
