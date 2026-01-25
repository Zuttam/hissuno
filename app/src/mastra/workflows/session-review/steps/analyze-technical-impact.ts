/**
 * Step: Analyze Technical Impact
 *
 * Combined agent-based step that analyzes both system impact and
 * implementation effort using the Technical Analyst agent with
 * codebase exploration tools.
 *
 * Note: Codebase is prepared by the prepare-codebase step at the start
 * of the workflow. This step uses localCodePath from context.
 */

import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import {
  preparedPMContextSchema,
  similarIssueSchema,
  impactAnalysisSchema,
  effortEstimationSchema,
} from '../schemas'

const analyzeTechnicalImpactInputSchema = preparedPMContextSchema.extend({
  similarIssues: z.array(similarIssueSchema),
})

const analyzeTechnicalImpactOutputSchema = analyzeTechnicalImpactInputSchema.extend({
  impactAnalysis: impactAnalysisSchema.nullable(),
  effortEstimation: effortEstimationSchema.nullable(),
})

/**
 * Schema for parsing agent JSON response
 */
const agentResponseSchema = z.object({
  impactAnalysis: z.object({
    affectedAreas: z.array(
      z.object({
        area: z.string(),
        category: z.string(),
        relevance: z.number(),
      })
    ),
    impactScore: z.number().min(1).max(5),
    reasoning: z.string(),
  }),
  effortEstimation: z.object({
    estimate: z.enum(['trivial', 'small', 'medium', 'large', 'xlarge']),
    reasoning: z.string(),
    affectedFiles: z.array(z.string()),
    confidence: z.number().min(0).max(1),
  }),
})

export const analyzeTechnicalImpact = createStep({
  id: 'analyze-technical-impact',
  description: 'Analyze impact and estimate effort using codebase analysis',
  inputSchema: analyzeTechnicalImpactInputSchema,
  outputSchema: analyzeTechnicalImpactOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { projectId, messages, tags, localCodePath } = inputData
    logger?.info('[analyze-technical-impact] Starting', { projectId, hasCodebase: !!localCodePath })
    await writer?.write({ type: 'progress', message: 'Analyzing technical impact...' })

    // Get the Technical Analyst agent
    const agent = mastra?.getAgent('technicalAnalystAgent')
    if (!agent) {
      logger?.warn('[analyze-technical-impact] Technical Analyst agent not found, skipping')
      return {
        ...inputData,
        impactAnalysis: null,
        effortEstimation: null,
      }
    }

    // Use localCodePath from workflow context (prepared by prepare-codebase step)
    const localPath = localCodePath

    // Build prompt for the agent
    const conversationSummary = messages
      .map((m) => `[${m.role.toUpperCase()}]: ${m.content.slice(0, 1000)}`)
      .join('\n\n')

    const prompt = `Analyze this customer support session and provide impact/effort assessment.

## Session Tags
${tags.length > 0 ? tags.join(', ') : 'No tags applied'}

## Customer Conversation
${conversationSummary}

## Codebase Context
${localPath ? `Local path: ${localPath}` : 'No codebase available - use your general knowledge to estimate.'}

Analyze the session and return your assessment as JSON.`

    try {
      await writer?.write({ type: 'progress', message: 'Running technical analysis...' })

      const response = await agent.generate(prompt)
      const text = typeof response.text === 'string' ? response.text : ''

      // Extract JSON from response
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        logger?.warn('[analyze-technical-impact] No JSON found in agent response')
        return {
          ...inputData,
          impactAnalysis: null,
          effortEstimation: null,
        }
      }

      // Parse and validate the response
      const parsed = JSON.parse(jsonMatch[0])
      const validated = agentResponseSchema.safeParse(parsed)

      if (!validated.success) {
        logger?.warn('[analyze-technical-impact] Invalid agent response format', {
          errors: validated.error.errors,
        })
        return {
          ...inputData,
          impactAnalysis: null,
          effortEstimation: null,
        }
      }

      const { impactAnalysis, effortEstimation } = validated.data

      await writer?.write({
        type: 'progress',
        message: `Impact: ${impactAnalysis.impactScore}/5, Effort: ${effortEstimation.estimate}`,
      })

      logger?.info('[analyze-technical-impact] Completed', {
        impactScore: impactAnalysis.impactScore,
        effort: effortEstimation.estimate,
        affectedAreas: impactAnalysis.affectedAreas.length,
        affectedFiles: effortEstimation.affectedFiles.length,
      })

      return {
        ...inputData,
        impactAnalysis,
        effortEstimation,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger?.error('[analyze-technical-impact] Agent error', { error: message })

      return {
        ...inputData,
        impactAnalysis: null,
        effortEstimation: null,
      }
    }
  },
})
