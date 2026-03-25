/**
 * Schemas for the Source Analysis Workflow
 */

import { z } from 'zod'

export const sourceAnalysisInputSchema = z.object({
  projectId: z.string(),
  sourceId: z.string(),
  sourceType: z.enum(['website', 'docs_portal', 'uploaded_doc', 'raw_text', 'codebase', 'notion']),
  url: z.string().nullable(),
  storagePath: z.string().nullable(),
  content: z.string().nullable(),
  analysisScope: z.string().nullable(),
  notionPageId: z.string().nullable().optional(),
  origin: z.string().nullable().optional(),
  sourceName: z.string().nullable().optional(),
})

export type SourceAnalysisInput = z.infer<typeof sourceAnalysisInputSchema>

export const fetchedContentSchema = sourceAnalysisInputSchema.extend({
  fetchedContent: z.string(),
  hasContent: z.boolean(),
  /** Codebase lease fields (only for codebase type) */
  localCodePath: z.string().nullable(),
  codebaseLeaseId: z.string().nullable(),
  codebaseCommitSha: z.string().nullable(),
})

export type FetchedContent = z.infer<typeof fetchedContentSchema>

export const sanitizedContentSchema = fetchedContentSchema.extend({
  sanitizedContent: z.string(),
  redactionCount: z.number(),
})

export type SanitizedContent = z.infer<typeof sanitizedContentSchema>

export const sourceAnalysisOutputSchema = z.object({
  projectId: z.string(),
  sourceId: z.string(),
  saved: z.boolean(),
  chunksEmbedded: z.number(),
  errors: z.array(z.string()),
  /** Codebase cleanup status */
  codebaseLeaseId: z.string().nullable(),
  codebaseCleanedUp: z.boolean().nullable(),
})

export type SourceAnalysisOutput = z.infer<typeof sourceAnalysisOutputSchema>

export const findRelationshipsOutputSchema = sourceAnalysisOutputSchema.extend({
  relationshipsCreated: z.number(),
})

export type FindRelationshipsOutput = z.infer<typeof findRelationshipsOutputSchema>
