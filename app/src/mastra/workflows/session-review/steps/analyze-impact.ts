/**
 * Step: Analyze Impact
 *
 * Deterministic step that analyzes which system areas would be affected
 * by the issue using knowledge embeddings.
 */

import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { preparedPMContextSchema, impactAnalysisSchema, similarIssueSchema } from '../schemas'

const analyzeImpactInputSchema = preparedPMContextSchema.extend({
  similarIssues: z.array(similarIssueSchema),
})

const analyzeImpactOutputSchema = analyzeImpactInputSchema.extend({
  impactAnalysis: impactAnalysisSchema.nullable(),
})

export const analyzeImpact = createStep({
  id: 'analyze-impact',
  description: 'Analyze system areas affected by the issue',
  inputSchema: analyzeImpactInputSchema,
  outputSchema: analyzeImpactOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { projectId, messages, tags } = inputData
    logger?.info('[analyze-impact] Starting', { projectId })
    await writer?.write({ type: 'progress', message: 'Analyzing system impact...' })

    // Build search query from user messages
    const searchQuery = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join('\n')

    // Determine issue type from tags for scoring
    let issueType: 'bug' | 'feature_request' | 'change_request' = 'change_request'
    if (tags.includes('bug')) {
      issueType = 'bug'
    } else if (tags.includes('feature_request')) {
      issueType = 'feature_request'
    }

    if (!searchQuery.trim()) {
      logger?.info('[analyze-impact] No search query available, skipping')
      return {
        ...inputData,
        impactAnalysis: null,
      }
    }

    try {
      const { searchKnowledgeEmbeddings } = await import('@/lib/knowledge/embedding-service')

      const results = await searchKnowledgeEmbeddings(projectId, searchQuery, {
        limit: 10,
        similarityThreshold: 0.5,
      })

      if (results.length === 0) {
        logger?.info('[analyze-impact] No knowledge matches found')
        return {
          ...inputData,
          impactAnalysis: {
            affectedAreas: [],
            impactScore: 2, // Default moderate impact
            reasoning: 'No related knowledge found. Unable to assess impact accurately.',
          },
        }
      }

      // Build affected areas from results
      const affectedAreas = results.map((r) => ({
        area: r.sectionHeading ?? r.chunkText.slice(0, 100),
        category: r.category,
        relevance: Math.round(r.similarity * 100) / 100,
      }))

      // Calculate impact score
      const categoryWeights: Record<string, number> = {
        technical: 1.5,
        product: 1.2,
        business: 1.0,
        faq: 0.8,
        how_to: 0.7,
      }

      const weightedScore = results.reduce((sum, r) => {
        return sum + r.similarity * (categoryWeights[r.category] ?? 1)
      }, 0)

      const typeMultiplier = issueType === 'bug' ? 1.3 : 1.0
      const rawScore = (weightedScore / results.length) * typeMultiplier * 5
      const impactScore = Math.min(5, Math.max(1, Math.round(rawScore)))

      const uniqueCategories = [...new Set(results.map((r) => r.category))]
      const avgRelevance = results.reduce((s, r) => s + r.similarity, 0) / results.length

      const reasoning =
        `Affects ${uniqueCategories.length} system area(s) (${uniqueCategories.join(', ')}). ` +
        `Found ${results.length} related knowledge chunks with ${Math.round(avgRelevance * 100)}% average relevance.`

      await writer?.write({
        type: 'progress',
        message: `Impact score: ${impactScore}/5`,
      })

      logger?.info('[analyze-impact] Completed', { impactScore, areaCount: affectedAreas.length })

      return {
        ...inputData,
        impactAnalysis: {
          affectedAreas,
          impactScore,
          reasoning,
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger?.warn('[analyze-impact] Analysis failed', { error: message })

      return {
        ...inputData,
        impactAnalysis: null,
      }
    }
  },
})
