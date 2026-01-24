/**
 * Step: Estimate Effort
 *
 * Deterministic step that estimates implementation effort
 * based on technical knowledge and affected areas.
 */

import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import {
  preparedPMContextSchema,
  similarIssueSchema,
  impactAnalysisSchema,
  effortEstimationSchema,
} from '../schemas'

const estimateEffortInputSchema = preparedPMContextSchema.extend({
  similarIssues: z.array(similarIssueSchema),
  impactAnalysis: impactAnalysisSchema.nullable(),
})

const estimateEffortOutputSchema = estimateEffortInputSchema.extend({
  effortEstimation: effortEstimationSchema.nullable(),
})

export const estimateEffort = createStep({
  id: 'estimate-effort',
  description: 'Estimate implementation effort for the issue',
  inputSchema: estimateEffortInputSchema,
  outputSchema: estimateEffortOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { projectId, messages, tags, impactAnalysis } = inputData
    logger?.info('[estimate-effort] Starting', { projectId })
    await writer?.write({ type: 'progress', message: 'Estimating effort...' })

    // Build search query for technical knowledge from user messages
    const searchQuery =
      messages
        .filter((m) => m.role === 'user')
        .map((m) => m.content)
        .join('\n') + ' implementation architecture'

    // Determine issue type from tags
    let issueType: 'bug' | 'feature_request' | 'change_request' = 'change_request'
    if (tags.includes('bug')) {
      issueType = 'bug'
    } else if (tags.includes('feature_request')) {
      issueType = 'feature_request'
    }

    if (!searchQuery.trim()) {
      logger?.info('[estimate-effort] No search query available, skipping')
      return {
        ...inputData,
        effortEstimation: null,
      }
    }

    try {
      const { searchKnowledgeEmbeddings } = await import('@/lib/knowledge/embedding-service')

      // Search only technical knowledge
      const results = await searchKnowledgeEmbeddings(projectId, searchQuery, {
        categories: ['technical'],
        limit: 8,
        similarityThreshold: 0.5,
      })

      // Extract file patterns from technical knowledge
      const filePatterns: string[] = []
      const codePattern = /\b(?:[\w-]+\.(?:ts|tsx|js|jsx|py|go|rs|java|rb|php|vue|svelte))\b/g

      for (const result of results) {
        const matches = result.chunkText.match(codePattern)
        if (matches) {
          filePatterns.push(...matches)
        }
      }

      const affectedFiles = [...new Set(filePatterns)].slice(0, 10)

      // Calculate effort based on heuristics
      const affectedAreaCount = impactAnalysis?.affectedAreas.length ?? 0

      const factors = {
        // Issue type score
        typeScore: issueType === 'bug' ? 1 : issueType === 'change_request' ? 2 : 3,
        // Affected areas from impact analysis
        areaScore: Math.min(affectedAreaCount, 5),
        // Technical knowledge hits
        techScore: results.length,
        // File count
        fileScore: affectedFiles.length,
      }

      const totalScore =
        factors.typeScore + factors.areaScore + factors.techScore * 0.5 + factors.fileScore * 0.3

      let estimate: 'trivial' | 'small' | 'medium' | 'large' | 'xlarge'
      if (totalScore < 3) estimate = 'trivial'
      else if (totalScore < 5) estimate = 'small'
      else if (totalScore < 8) estimate = 'medium'
      else if (totalScore < 12) estimate = 'large'
      else estimate = 'xlarge'

      // Confidence based on how much technical knowledge we found
      const confidence = results.length > 0 ? 0.6 + Math.min(results.length, 5) * 0.08 : 0.3

      const reasoning =
        `Estimated ${estimate} effort based on: ` +
        `${issueType} type, ${affectedAreaCount} affected areas, ` +
        `${affectedFiles.length} potential files. ` +
        `Technical knowledge relevance: ${results.length} matches found.`

      await writer?.write({
        type: 'progress',
        message: `Effort: ${estimate} (${Math.round(confidence * 100)}% confidence)`,
      })

      logger?.info('[estimate-effort] Completed', { estimate, confidence })

      return {
        ...inputData,
        effortEstimation: {
          estimate,
          reasoning,
          affectedFiles,
          confidence,
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger?.warn('[estimate-effort] Estimation failed', { error: message })

      return {
        ...inputData,
        effortEstimation: null,
      }
    }
  },
})
