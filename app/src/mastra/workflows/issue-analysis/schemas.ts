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
  analysisGuidelines: z.string().optional(),
  briefGuidelines: z.string().optional(),
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
 * Context prepared for issue analysis (includes product scope from entity relationships)
 */
export const preparedContextSchema = workflowContextWithCodebaseSchema.extend({
  issue: z.object({
    id: z.string(),
    type: z.string(),
    name: z.string(),
    description: z.string(),
    sessionCount: z.number(),
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
  productScopeId: z.string().nullable(),
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
  goalAlignments: z.array(z.object({ goalId: z.string(), reasoning: z.string().optional() })).optional(),
  technicalConfidenceScore: z.number().min(1).max(5).nullable(),
  technicalConfidenceReasoning: z.string().nullable(),
})

export type AnalyzeOutput = z.infer<typeof analyzeOutputSchema>

// ============================================================================
// WORKFLOW OUTPUT
// ============================================================================

export const workflowOutputSchema = z.object({
  issueId: z.string(),
  projectId: z.string(),
  success: z.boolean(),
  reachScore: z.number().nullable(),
  impactScore: z.number().nullable(),
  confidenceScore: z.number().nullable(),
  effortScore: z.number().nullable(),
  riceScore: z.number().nullable(),
  priority: z.string().nullable(),
  briefGenerated: z.boolean(),
  error: z.string().optional(),
  // Codebase cleanup status
  codebaseLeaseId: z.string().optional(),
  codebaseCleanedUp: z.boolean().optional(),
})

export type WorkflowOutput = z.infer<typeof workflowOutputSchema>
