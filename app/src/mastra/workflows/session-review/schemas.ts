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

// ============================================================================
// MULTI-STEP PM REVIEW SCHEMAS
// ============================================================================

/**
 * Similar issue result from semantic search
 */
export const similarIssueSchema = z.object({
  issueId: z.string(),
  title: z.string(),
  description: z.string(),
  upvoteCount: z.number(),
  status: z.string(),
  similarity: z.number(),
})

export type SimilarIssueType = z.infer<typeof similarIssueSchema>

/**
 * Impact analysis result
 */
export const impactAnalysisSchema = z.object({
  affectedAreas: z.array(
    z.object({
      area: z.string(),
      category: z.string(),
      relevance: z.number(),
    })
  ),
  impactScore: z.number().min(1).max(5),
  reasoning: z.string(),
})

export type ImpactAnalysisType = z.infer<typeof impactAnalysisSchema>

/**
 * Effort estimation result
 */
export const effortEstimationSchema = z.object({
  estimate: z.enum(['trivial', 'small', 'medium', 'large', 'xlarge']),
  reasoning: z.string(),
  affectedFiles: z.array(z.string()),
  confidence: z.number().min(0).max(1),
})

export type EffortEstimationType = z.infer<typeof effortEstimationSchema>

/**
 * Prepared PM context (output of prepare-pm-context step)
 */
export const preparedPMContextSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  tags: z.array(sessionTagSchema),
  tagsApplied: z.boolean(),
  reasoning: z.string(),
  session: z.object({
    id: z.string(),
    userId: z.string().nullable(),
    userMetadata: z.record(z.string()).nullable(),
    pageUrl: z.string().nullable(),
    pageTitle: z.string().nullable(),
    messageCount: z.number(),
    status: z.string(),
  }),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      createdAt: z.string(),
    })
  ),
  settings: z.object({
    issueTrackingEnabled: z.boolean(),
    issueSpecThreshold: z.number(),
    pmDedupIncludeClosed: z.boolean(),
  }),
})

export type PreparedPMContextType = z.infer<typeof preparedPMContextSchema>

/**
 * PM decision (output of pm-decision step)
 */
export const pmDecisionSchema = z.object({
  action: z.enum(['create', 'upvote', 'skip']),
  // For create action
  newIssue: z
    .object({
      type: z.enum(['bug', 'feature_request', 'change_request']),
      title: z.string(),
      description: z.string(),
      priority: z.enum(['low', 'medium', 'high']),
    })
    .optional(),
  // For upvote action
  existingIssueId: z.string().optional(),
  // For skip action
  skipReason: z.string().optional(),
})

export type PMDecisionType = z.infer<typeof pmDecisionSchema>

/**
 * Enriched context for PM decision (combines all pre-computed data)
 */
export const enrichedPMContextSchema = preparedPMContextSchema.extend({
  similarIssues: z.array(similarIssueSchema),
  impactAnalysis: impactAnalysisSchema.nullable(),
  effortEstimation: effortEstimationSchema.nullable(),
})

export type EnrichedPMContextType = z.infer<typeof enrichedPMContextSchema>

/**
 * Execute decision output
 */
export const executeDecisionOutputSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  tags: z.array(sessionTagSchema),
  tagsApplied: z.boolean(),
  action: z.enum(['created', 'upvoted', 'skipped']),
  issueId: z.string().optional(),
  issueTitle: z.string().optional(),
  skipReason: z.string().optional(),
  thresholdMet: z.boolean().optional(),
  specGenerated: z.boolean().optional(),
  impactScore: z.number().optional(),
  effortEstimate: z.string().optional(),
})

export type ExecuteDecisionOutputType = z.infer<typeof executeDecisionOutputSchema>

// ============================================================================
// WORKFLOW OUTPUT
// ============================================================================

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
  // Enriched fields
  impactScore: z.number().optional(),
  effortEstimate: z.string().optional(),
})

export type WorkflowOutput = z.infer<typeof workflowOutputSchema>
