/**
 * Shared Zod schemas for the Knowledge Analysis Workflow
 */

import { z } from 'zod'

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const sourceInputSchema = z.object({
  id: z.string(),
  type: z.enum(['website', 'docs_portal', 'uploaded_doc', 'raw_text', 'codebase']),
  url: z.string().nullable().optional(),
  storagePath: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
})

export type SourceInput = z.infer<typeof sourceInputSchema>

/**
 * Workflow input schema - projectId and sources only.
 * Codebase access is handled internally by prepare-codebase step.
 */
export const workflowInputSchema = z.object({
  projectId: z.string(),
  namedPackageId: z.string().nullable().optional(),
  analysisScope: z.string().nullable().optional(),
  sources: z.array(sourceInputSchema),
})

export type WorkflowInput = z.infer<typeof workflowInputSchema>

/**
 * Internal context after prepare-codebase step.
 * Adds codebase lease fields for workflow-internal use.
 */
export const workflowContextWithCodebaseSchema = workflowInputSchema.extend({
  localCodePath: z.string().nullable(),
  codebaseLeaseId: z.string(),
  codebaseCommitSha: z.string().nullable(),
  // Named package ID (passed through)
  namedPackageId: z.string().nullable().optional(),
})

export type WorkflowContextWithCodebase = z.infer<typeof workflowContextWithCodebaseSchema>

// ============================================================================
// STEP OUTPUT SCHEMAS
// ============================================================================

export const analyzeCodebaseOutputSchema = z.object({
  projectId: z.string(),
  namedPackageId: z.string().nullable().optional(),
  sources: z.array(sourceInputSchema),
  codebaseAnalysis: z.string(),
  hasCodebase: z.boolean(),
  // Codebase lease fields (passed through from prepare-codebase)
  localCodePath: z.string().nullable(),
  codebaseLeaseId: z.string(),
  codebaseCommitSha: z.string().nullable(),
})

export type AnalyzeCodebaseOutput = z.infer<typeof analyzeCodebaseOutputSchema>

export const analysisResultSchema = z.object({
  sourceId: z.string().optional(),
  type: z.string(),
  content: z.string(),
  error: z.string().optional(),
})

export type AnalysisResult = z.infer<typeof analysisResultSchema>

export const analyzeSourcesOutputSchema = z.object({
  projectId: z.string(),
  namedPackageId: z.string().nullable().optional(),
  analysisResults: z.array(analysisResultSchema),
  codebaseAnalysis: z.string(),
  hasCodebase: z.boolean(),
  // Codebase lease fields (passed through)
  localCodePath: z.string().nullable(),
  codebaseLeaseId: z.string(),
  codebaseCommitSha: z.string().nullable(),
})

export type AnalyzeSourcesOutput = z.infer<typeof analyzeSourcesOutputSchema>

export const compiledKnowledgeSchema = z.object({
  projectId: z.string(),
  namedPackageId: z.string().nullable().optional(),
  business: z.string(),
  product: z.string(),
  technical: z.string(),
  faq: z.string(),
  how_to: z.string(),
  // Codebase lease fields (passed through)
  localCodePath: z.string().nullable().optional(),
  codebaseLeaseId: z.string().optional(),
  codebaseCommitSha: z.string().nullable().optional(),
})

export type CompiledKnowledge = z.infer<typeof compiledKnowledgeSchema>

export const redactionSummarySchema = z.object({
  totalRedactions: z.number(),
  byCategory: z.object({
    business: z.number(),
    product: z.number(),
    technical: z.number(),
    faq: z.number(),
    how_to: z.number(),
  }),
  types: z.array(z.string()),
})

export type RedactionSummary = z.infer<typeof redactionSummarySchema>

export const sanitizedKnowledgeSchema = z.object({
  projectId: z.string(),
  namedPackageId: z.string().nullable().optional(),
  business: z.string(),
  product: z.string(),
  technical: z.string(),
  faq: z.string(),
  how_to: z.string(),
  redactionSummary: redactionSummarySchema,
  // Codebase lease fields (passed through)
  localCodePath: z.string().nullable().optional(),
  codebaseLeaseId: z.string().optional(),
  codebaseCommitSha: z.string().nullable().optional(),
})

export type SanitizedKnowledge = z.infer<typeof sanitizedKnowledgeSchema>

export const knowledgePackageSchema = z.object({
  category: z.string(),
  path: z.string(),
  version: z.number(),
})

export type KnowledgePackage = z.infer<typeof knowledgePackageSchema>

export const workflowOutputSchema = z.object({
  projectId: z.string(),
  namedPackageId: z.string().nullable().optional(),
  saved: z.boolean(),
  packages: z.array(knowledgePackageSchema),
  errors: z.array(z.string()),
  // Codebase lease fields (passed through)
  localCodePath: z.string().nullable().optional(),
  codebaseLeaseId: z.string().optional(),
  codebaseCommitSha: z.string().nullable().optional(),
})

export type WorkflowOutput = z.infer<typeof workflowOutputSchema>

// ============================================================================
// EMBEDDING STEP SCHEMAS
// ============================================================================

export const embeddingResultSchema = z.object({
  success: z.boolean(),
  chunksEmbedded: z.number(),
  embeddingErrors: z.array(z.string()),
})

export type EmbeddingResult = z.infer<typeof embeddingResultSchema>

export const workflowWithEmbeddingOutputSchema = z.object({
  saved: z.boolean(),
  packages: z.array(knowledgePackageSchema),
  errors: z.array(z.string()),
  embedding: embeddingResultSchema,
  // Codebase cleanup status
  codebaseLeaseId: z.string().optional(),
  codebaseCleanedUp: z.boolean().optional(),
})

export type WorkflowWithEmbeddingOutput = z.infer<typeof workflowWithEmbeddingOutputSchema>
