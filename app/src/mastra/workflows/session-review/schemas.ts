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
  classificationGuidelines: z.string().optional(),
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
  productScopeId: z.string().nullable(),
})

export type ClassifyOutput = z.infer<typeof classifyOutputSchema>

export const summarizeOutputSchema = classifyOutputSchema.extend({
  name: z.string(),
  description: z.string(),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      createdAt: z.string(),
    })
  ),
})

export type SummarizeOutput = z.infer<typeof summarizeOutputSchema>

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
 * Prepared PM context (output of prepare-pm-context step)
 */
export const preparedPMContextSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  tags: z.array(sessionTagSchema),
  tagsApplied: z.boolean(),
  reasoning: z.string(),
  productScopeId: z.string().nullable(),
  productScopeContext: z.object({
    name: z.string(),
    description: z.string(),
    matchedGoalId: z.string().nullable(),
    matchedGoalText: z.string().nullable(),
    reasoning: z.string().nullable(),
  }).nullable().optional(),
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
  productScopeId: z.string().nullable(),
  action: z.enum(['created', 'upvoted', 'skipped']),
  issueId: z.string().optional(),
  issueTitle: z.string().optional(),
  skipReason: z.string().optional(),
})

export type ExecuteDecisionOutputType = z.infer<typeof executeDecisionOutputSchema>

// ============================================================================
// WORKFLOW OUTPUT
// ============================================================================

export const workflowOutputSchema = z.object({
  // Classification result
  tags: z.array(sessionTagSchema),
  tagsApplied: z.boolean(),
  productScopeId: z.string().nullable(),
  // PM Review result
  action: z.enum(['created', 'upvoted', 'skipped']),
  issueId: z.string().optional(),
  issueTitle: z.string().optional(),
  skipReason: z.string().optional(),
})

export type WorkflowOutput = z.infer<typeof workflowOutputSchema>
