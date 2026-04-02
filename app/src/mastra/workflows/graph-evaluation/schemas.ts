/**
 * Shared Zod schemas for the Graph Evaluation Workflow
 */

import { z } from 'zod'

// ============================================================================
// ENTITY TYPES
// ============================================================================

export const entityTypeEnum = z.enum(['session', 'issue', 'knowledge_source', 'contact', 'company'])

export type GraphEntityType = z.infer<typeof entityTypeEnum>

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const graphEvaluationInputSchema = z.object({
  projectId: z.string(),
  entityType: entityTypeEnum,
  entityId: z.string(),
})

export type GraphEvaluationInput = z.infer<typeof graphEvaluationInputSchema>

// ============================================================================
// STEP OUTPUT SCHEMAS
// ============================================================================

export const entityContentSchema = graphEvaluationInputSchema.extend({
  contentForSearch: z.string(),
  contentForTextMatch: z.string(),
  entityName: z.string(),
  guidelines: z.string().nullable(),
})

export type EntityContent = z.infer<typeof entityContentSchema>

export const topicsExtractedSchema = entityContentSchema.extend({
  topics: z.array(z.string()),
  combinedQuery: z.string(),
})

export type TopicsExtracted = z.infer<typeof topicsExtractedSchema>

// ============================================================================
// CREATION CONTEXT (opt-in Phase 2)
// ============================================================================

export interface CreationContext {
  tags: string[]
  messages: { role: string; content: string; createdAt: string }[]
  userMetadata: Record<string, string> | null
}

// ============================================================================
// WORKFLOW OUTPUT
// ============================================================================

export const graphEvaluationOutputSchema = z.object({
  projectId: z.string(),
  entityType: entityTypeEnum,
  entityId: z.string(),
  relationshipsCreated: z.number(),
  productScopeId: z.string().nullable(),
  errors: z.array(z.string()),
  // Creation policy results (null/empty when creation not enabled)
  createdContactId: z.string().nullable(),
  createdIssueIds: z.array(z.string()),
  issueResults: z.array(z.object({
    action: z.enum(['created', 'linked', 'skipped']),
    issueId: z.string().nullable(),
    issueName: z.string().nullable(),
  })),
  pmAction: z.enum(['created', 'linked', 'skipped']).nullable(),
  pmSkipReason: z.string().nullable(),
})

export type GraphEvaluationOutput = z.infer<typeof graphEvaluationOutputSchema>
