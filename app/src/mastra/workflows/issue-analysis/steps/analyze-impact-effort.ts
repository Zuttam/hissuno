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
    affectedAreas: z.array(z.object({
      area: z.string(),
      category: z.string(),
      relevance: z.number(),
    })),
    impactScore: z.number().min(1).max(5),
    reasoning: z.string(),
  }),
  effortEstimation: z.object({
    estimate: z.enum(['trivial', 'small', 'medium', 'large', 'xlarge']),
    reasoning: z.string(),
    affectedFiles: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  }).optional(),
})

function buildNullResult(inputData: z.infer<typeof preparedContextSchema>) {
  return {
    ...inputData,
    technicalImpactScore: null,
    technicalImpactReasoning: null,
    technicalEffortEstimate: null,
    technicalEffortReasoning: null,
    technicalAffectedFiles: [] as string[],
    technicalAffectedAreas: [] as Array<{ area: string; category: string; relevance: number }>,
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

    const { issue, localCodePath, knowledgeContext, analysisGuidelines } = inputData
    logger?.info('[analyze-impact-effort] Starting', { issueId: issue.id, hasCodebase: !!localCodePath })
    await writer?.write({ type: 'progress', message: 'Analyzing technical impact...' })

    const agent = mastra?.getAgent('technicalAnalystAgent')
    if (!agent) {
      logger?.warn('[analyze-impact-effort] Technical Analyst agent not found, skipping')
      return buildNullResult(inputData)
    }

    const prompt = `Analyze this issue and provide impact/effort assessment.

## Issue
Title: ${issue.title}
Type: ${issue.type}
Description: ${issue.description}
Upvotes: ${issue.upvoteCount}

## Knowledge Context
${knowledgeContext || 'No knowledge available.'}

## Codebase Context
${localCodePath ? `Local path: ${localCodePath}` : 'No codebase available - use your general knowledge to estimate.'}

${analysisGuidelines ? `## Analysis Guidelines\n\n${analysisGuidelines}\n\n` : ''}Analyze the issue and return your assessment as JSON with this structure:
{
  "impactAnalysis": {
    "affectedAreas": [{ "area": "...", "category": "...", "relevance": 0.0-1.0 }],
    "impactScore": 1-5,
    "reasoning": "..."
  },
  "effortEstimation": {
    "estimate": "trivial" | "small" | "medium" | "large" | "xlarge",
    "reasoning": "...",
    "affectedFiles": ["..."],
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
        affectedAreas: impactAnalysis.affectedAreas.length,
      })

      return {
        ...inputData,
        technicalImpactScore: impactAnalysis.impactScore,
        technicalImpactReasoning: impactAnalysis.reasoning,
        technicalEffortEstimate: effortEstimation?.estimate ?? null,
        technicalEffortReasoning: effortEstimation?.reasoning ?? null,
        technicalAffectedFiles: effortEstimation?.affectedFiles ?? [],
        technicalAffectedAreas: impactAnalysis.affectedAreas,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger?.error('[analyze-impact-effort] Agent error', { error: message })
      return buildNullResult(inputData)
    }
  },
})
