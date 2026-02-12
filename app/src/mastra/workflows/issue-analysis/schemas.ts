/**
 * Shared Zod schemas for the Issue Analysis Workflow
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
 * Context prepared for issue analysis
 */
export const preparedContextSchema = workflowContextWithCodebaseSchema.extend({
  issue: z.object({
    id: z.string(),
    type: z.string(),
    title: z.string(),
    description: z.string(),
    upvoteCount: z.number(),
    impactScore: z.number().nullable(),
    effortEstimate: z.string().nullable(),
    priorityManualOverride: z.boolean(),
  }),
  sessions: z.array(z.object({
    id: z.string(),
    createdAt: z.string(),
    contactId: z.string().nullable(),
    companyId: z.string().nullable(),
    companyArr: z.number().nullable(),
    companyStage: z.string().nullable(),
  })),
  sessionTimestamps: z.array(z.string()),
  knowledgeContext: z.string(),
})

export type PreparedContext = z.infer<typeof preparedContextSchema>

/**
 * Output after technical impact/effort analysis
 */
export const analyzeOutputSchema = preparedContextSchema.extend({
  technicalImpactScore: z.number().min(1).max(5).nullable(),
  technicalImpactReasoning: z.string().nullable(),
  technicalEffortEstimate: z.string().nullable(),
  technicalEffortReasoning: z.string().nullable(),
  technicalAffectedFiles: z.array(z.string()),
  technicalAffectedAreas: z.array(z.object({
    area: z.string(),
    category: z.string(),
    relevance: z.number(),
  })),
})

export type AnalyzeOutput = z.infer<typeof analyzeOutputSchema>

// ============================================================================
// WORKFLOW OUTPUT
// ============================================================================

export const workflowOutputSchema = z.object({
  issueId: z.string(),
  projectId: z.string(),
  success: z.boolean(),
  velocityScore: z.number().nullable(),
  impactScore: z.number().nullable(),
  effortScore: z.number().nullable(),
  priority: z.string().nullable(),
  error: z.string().optional(),
  // Codebase cleanup status
  codebaseLeaseId: z.string().optional(),
  codebaseCleanedUp: z.boolean().optional(),
})

export type WorkflowOutput = z.infer<typeof workflowOutputSchema>
