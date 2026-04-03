/**
 * Step: Analyze Impact & Effort
 *
 * Runs the Technical Analyst agent to assess technical impact and
 * implementation effort. If no codebase is available, skips effort
 * estimation and focuses on impact only.
 */

import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { preparedContextSchema, analyzeOutputSchema } from '../schemas'

const agentResponseSchema = z.object({
  impactAnalysis: z.object({
    impactScore: z.number().min(1).max(5),
    reasoning: z.string(),
  }),
  effortEstimation: z.object({
    estimate: z.enum(['trivial', 'small', 'medium', 'large', 'xlarge']),
    reasoning: z.string(),
    confidence: z.number().min(0).max(1),
  }).optional(),
  goalAlignments: z.array(z.object({ goalId: z.string(), reasoning: z.string().optional() })).optional(),
  confidenceScore: z.number().min(1).max(5).optional(),
  confidenceReasoning: z.string().optional(),
})

function buildNullResult(inputData: z.infer<typeof preparedContextSchema>) {
  return {
    ...inputData,
    technicalImpactScore: null,
    technicalImpactReasoning: null,
    technicalEffortEstimate: null,
    technicalEffortReasoning: null,
    goalAlignments: undefined,
    technicalConfidenceScore: null as number | null,
    technicalConfidenceReasoning: null as string | null,
  }
}

export const analyzeImpactEffort = createStep({
  id: 'analyze-impact-effort',
  description: 'Analyze impact and effort using Technical Analyst agent',
  inputSchema: preparedContextSchema,
  outputSchema: analyzeOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { issue, localCodePath, analysisGuidelines, projectId } = inputData
    logger?.info('[analyze-impact-effort] Starting', { issueId: issue.id, hasCodebase: !!localCodePath })
    await writer?.write({ type: 'progress', message: 'Analyzing technical impact...' })

    const agent = mastra?.getAgent('technicalAnalystAgent')
    if (!agent) {
      logger?.warn('[analyze-impact-effort] Technical Analyst agent not found, skipping')
      return buildNullResult(inputData)
    }

    const prompt = `Analyze this issue and provide impact/effort assessment.

## Issue
Name: ${issue.name}
Type: ${issue.type}
Description: ${issue.description}
Linked sessions: ${issue.sessionCount}

## Codebase Context
${localCodePath ? `Local path: ${localCodePath}` : 'No codebase available - use your general knowledge to estimate.'}

${analysisGuidelines ? `## Analysis Guidelines\n\n${analysisGuidelines}\n\n` : ''}Analyze the issue and return your assessment as JSON with this structure:
{
  "impactAnalysis": {
    "impactScore": 1-5,
    "reasoning": "..."
  },
  "effortEstimation": {
    "estimate": "trivial" | "small" | "medium" | "large" | "xlarge",
    "reasoning": "...",
    "confidence": 0.0-1.0
  }
}

${localCodePath ? 'Use the codebase tools to examine relevant files before making your assessment.' : 'The effortEstimation field is optional when no codebase is available.'}`

    try {
      await writer?.write({ type: 'progress', message: 'Running technical analysis...' })

      const response = await agent.generate(prompt, {
        maxSteps: 10,
      })

      const text = typeof response.text === 'string' ? response.text : ''

      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        logger?.warn('[analyze-impact-effort] No JSON found in agent response')
        return buildNullResult(inputData)
      }

      const parsed = JSON.parse(jsonMatch[0])
      const validated = agentResponseSchema.safeParse(parsed)

      if (!validated.success) {
        logger?.warn('[analyze-impact-effort] Invalid agent response format', {
          errors: validated.error.errors,
        })
        return buildNullResult(inputData)
      }

      const { impactAnalysis, effortEstimation } = validated.data

      await writer?.write({
        type: 'progress',
        message: `Impact: ${impactAnalysis.impactScore}/5${effortEstimation ? `, Effort: ${effortEstimation.estimate}` : ''}`,
      })

      logger?.info('[analyze-impact-effort] Completed', {
        impactScore: impactAnalysis.impactScore,
        effortEstimate: effortEstimation?.estimate ?? null,
      })

      const { confidenceScore: agentConfidence, confidenceReasoning: agentConfidenceReasoning, goalAlignments } = validated.data

      return {
        ...inputData,
        technicalImpactScore: impactAnalysis.impactScore,
        technicalImpactReasoning: impactAnalysis.reasoning,
        technicalEffortEstimate: effortEstimation?.estimate ?? null,
        technicalEffortReasoning: effortEstimation?.reasoning ?? null,
        goalAlignments,
        technicalConfidenceScore: agentConfidence ?? null,
        technicalConfidenceReasoning: agentConfidenceReasoning ?? null,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger?.error('[analyze-impact-effort] Agent error', { error: message })
      return buildNullResult(inputData)
    }
  },
})
