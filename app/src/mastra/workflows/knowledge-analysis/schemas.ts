/**
 * Shared Zod schemas for the Knowledge Analysis Workflow
 */

import { z } from 'zod'

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const sourceInputSchema = z.object({
  id: z.string(),
  type: z.enum(['website', 'docs_portal', 'uploaded_doc', 'raw_text']),
  url: z.string().nullable().optional(),
  storagePath: z.string().nullable().optional(),
  content: z.string().nullable().optional(),
})

export type SourceInput = z.infer<typeof sourceInputSchema>

export const workflowInputSchema = z.object({
  projectId: z.string(),
  sourceCodePath: z.string().nullable().optional(),
  analysisScope: z.string().nullable().optional(),
  sources: z.array(sourceInputSchema),
})

export type WorkflowInput = z.infer<typeof workflowInputSchema>

// ============================================================================
// STEP OUTPUT SCHEMAS
// ============================================================================

export const analyzeCodebaseOutputSchema = z.object({
  projectId: z.string(),
  sources: z.array(sourceInputSchema),
  codebaseAnalysis: z.string(),
  hasCodebase: z.boolean(),
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
  analysisResults: z.array(analysisResultSchema),
  codebaseAnalysis: z.string(),
  hasCodebase: z.boolean(),
})

export type AnalyzeSourcesOutput = z.infer<typeof analyzeSourcesOutputSchema>

export const compiledKnowledgeSchema = z.object({
  business: z.string(),
  product: z.string(),
  technical: z.string(),
})

export type CompiledKnowledge = z.infer<typeof compiledKnowledgeSchema>

export const knowledgePackageSchema = z.object({
  category: z.string(),
  path: z.string(),
  version: z.number(),
})

export type KnowledgePackage = z.infer<typeof knowledgePackageSchema>

export const workflowOutputSchema = z.object({
  saved: z.boolean(),
  packages: z.array(knowledgePackageSchema),
  errors: z.array(z.string()),
})

export type WorkflowOutput = z.infer<typeof workflowOutputSchema>
