/**
 * Step: Find Duplicates
 *
 * Deterministic step that searches for semantically similar issues
 * to enable deduplication in the PM decision step.
 */

import { createStep } from '@mastra/core/workflows'
import { z } from 'zod'
import { preparedPMContextSchema, similarIssueSchema } from '../schemas'

// Input is the same as prepare-pm-context output
const findDuplicatesOutputSchema = preparedPMContextSchema.extend({
  similarIssues: z.array(similarIssueSchema),
})

export const findDuplicates = createStep({
  id: 'find-duplicates',
  description: 'Search for semantically similar existing issues',
  inputSchema: preparedPMContextSchema,
  outputSchema: findDuplicatesOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { projectId, settings, messages, tags } = inputData
    logger?.info('[find-duplicates] Starting', { projectId })
    await writer?.write({ type: 'progress', message: 'Searching for similar issues...' })

    // Infer issue type from session tags
    let searchType: 'bug' | 'feature_request' | 'change_request' | undefined
    if (tags.includes('bug')) {
      searchType = 'bug'
    } else if (tags.includes('feature_request')) {
      searchType = 'feature_request'
    } else if (tags.includes('change_request')) {
      searchType = 'change_request'
    }

    // Use user messages as the search context
    const userMessages = messages
      .filter((m) => m.role === 'user')
      .map((m) => m.content)
      .join('\n')

    const searchTitle = userMessages.slice(0, 200)
    const searchDescription = userMessages

    // If we can't determine a type, skip similarity search
    if (!searchType || !searchTitle) {
      logger?.info('[find-duplicates] No actionable issue type detected, skipping search')
      return {
        ...inputData,
        similarIssues: [],
      }
    }

    try {
      const { searchSimilarIssues } = await import('@/lib/issues/embedding-service')

      const results = await searchSimilarIssues(projectId, searchTitle, searchDescription, {
        type: searchType,
        limit: 5,
        threshold: 0.5,
        includeClosed: settings.pmDedupIncludeClosed,
      })

      await writer?.write({
        type: 'progress',
        message: `Found ${results.length} similar issues`,
      })

      logger?.info('[find-duplicates] Completed', { count: results.length })

      return {
        ...inputData,
        similarIssues: results.map((r) => ({
          issueId: r.issueId,
          title: r.title,
          description: r.description,
          upvoteCount: r.upvoteCount,
          status: r.status,
          similarity: r.similarity,
        })),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger?.warn('[find-duplicates] Search failed, continuing without duplicates', { error: message })

      return {
        ...inputData,
        similarIssues: [],
      }
    }
  },
})
