/**
 * Shared Zod schemas for the Session Processing Workflow
 */

import { z } from 'zod'

export const sessionTagSchema = z.string().regex(
  /^[a-z][a-z0-9_]*$/,
  'Tag must be lowercase snake_case starting with a letter'
)

export const workflowInputSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  classificationGuidelines: z.string().optional(),
})

export type WorkflowInput = z.infer<typeof workflowInputSchema>

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

export const graphEvalOutputSchema = summarizeOutputSchema.extend({
  pmAction: z.enum(['created', 'linked', 'skipped']),
  createdIssueIds: z.array(z.string()),
  createdContactId: z.string().nullable(),
  pmSkipReason: z.string().nullable(),
})

export type GraphEvalOutput = z.infer<typeof graphEvalOutputSchema>

export const workflowOutputSchema = z.object({
  sessionId: z.string(),
  projectId: z.string(),
  tags: z.array(sessionTagSchema),
  tagsApplied: z.boolean(),
  name: z.string(),
  description: z.string(),
  productScopeId: z.string().nullable(),
  pmAction: z.enum(['created', 'linked', 'skipped']),
  createdIssueIds: z.array(z.string()),
})

export type WorkflowOutput = z.infer<typeof workflowOutputSchema>
