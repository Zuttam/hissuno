/**
 * Shared Zod schemas for the Spec Generation Workflow
 */

import { z } from 'zod'

// ============================================================================
// INPUT SCHEMAS
// ============================================================================

export const workflowInputSchema = z.object({
  issueId: z.string(),
  projectId: z.string(),
  runId: z.string(),
})

export type WorkflowInput = z.infer<typeof workflowInputSchema>

/**
 * Internal context after prepare-codebase step.
 */
export const workflowContextWithCodebaseSchema = workflowInputSchema.extend({
  localCodePath: z.string().nullable(),
  codebaseLeaseId: z.string(),
  codebaseCommitSha: z.string().nullable(),
})

export type WorkflowContextWithCodebase = z.infer<typeof workflowContextWithCodebaseSchema>

// ============================================================================
// STEP OUTPUT SCHEMAS
// ============================================================================

/**
 * Context prepared for spec generation
 */
export const preparedContextSchema = workflowContextWithCodebaseSchema.extend({
  issue: z.object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    description: z.string(),
    priority: z.string(),
    upvoteCount: z.number(),
    status: z.string(),
  }),
  linkedSessions: z.array(z.object({
    id: z.string(),
    userMessages: z.array(z.string()),
  })),
  knowledgeContext: z.string(),
})

export type PreparedContext = z.infer<typeof preparedContextSchema>

/**
 * Spec generation result
 */
export const generateSpecOutputSchema = preparedContextSchema.extend({
  spec: z.string().nullable(),
  specSaved: z.boolean(),
  error: z.string().optional(),
})

export type GenerateSpecOutput = z.infer<typeof generateSpecOutputSchema>

// ============================================================================
// WORKFLOW OUTPUT
// ============================================================================

export const workflowOutputSchema = z.object({
  issueId: z.string(),
  projectId: z.string(),
  success: z.boolean(),
  specGenerated: z.boolean(),
  error: z.string().optional(),
  // Codebase cleanup status
  codebaseLeaseId: z.string().optional(),
  codebaseCleanedUp: z.boolean().optional(),
})

export type WorkflowOutput = z.infer<typeof workflowOutputSchema>
