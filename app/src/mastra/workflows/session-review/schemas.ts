/**
 * Shared Zod schemas for the Session Review Workflow
 */

import { z } from 'zod'

// ============================================================================
// TAG DEFINITIONS
// ============================================================================

/**
 * Native session tags that are always available
 */
export const nativeTagSchema = z.enum([
  'general_feedback',
  'wins',
  'losses',
  'bug',
  'feature_request',
  'change_request',
])

export type NativeTagType = z.infer<typeof nativeTagSchema>

/**
 * Session tag schema that accepts both native tags and custom label slugs.
 * Custom label slugs must be lowercase snake_case starting with a letter.
 */
export const sessionTagSchema = z.string().regex(
  /^[a-z][a-z0-9_]*$/,
  'Tag must be lowercase snake_case starting with a letter'
)

export type SessionTagType = z.infer<typeof sessionTagSchema>

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const workflowInputSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
})

export type WorkflowInput = z.infer<typeof workflowInputSchema>

// ============================================================================
// STEP OUTPUT SCHEMAS
// ============================================================================

export const classifyOutputSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  tags: z.array(sessionTagSchema),
  tagsApplied: z.boolean(),
  reasoning: z.string(),
})

export type ClassifyOutput = z.infer<typeof classifyOutputSchema>

export const pmReviewResultSchema = z.object({
  action: z.enum(['created', 'upvoted', 'skipped']),
  issueId: z.string().optional(),
  issueTitle: z.string().optional(),
  skipReason: z.string().optional(),
  thresholdMet: z.boolean().optional(),
  specGenerated: z.boolean().optional(),
})

export type PMReviewResultType = z.infer<typeof pmReviewResultSchema>

export const workflowOutputSchema = z.object({
  // Classification result
  tags: z.array(sessionTagSchema),
  tagsApplied: z.boolean(),
  // PM Review result
  action: z.enum(['created', 'upvoted', 'skipped']),
  issueId: z.string().optional(),
  issueTitle: z.string().optional(),
  skipReason: z.string().optional(),
  thresholdMet: z.boolean().optional(),
  specGenerated: z.boolean().optional(),
})

export type WorkflowOutput = z.infer<typeof workflowOutputSchema>
