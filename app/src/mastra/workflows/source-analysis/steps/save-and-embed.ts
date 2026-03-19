/**
 * Step 3: Save and Embed
 *
 * Stores the sanitized content directly in the knowledge_sources DB column,
 * updates the record, and generates vector embeddings for semantic search.
 * Also handles codebase lease cleanup if applicable.
 */

import { createStep } from '@mastra/core/workflows'
import { sanitizedContentSchema, sourceAnalysisOutputSchema } from '../schemas'
import { embedKnowledgeSource } from '@/lib/knowledge/embedding-service'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { knowledgeSources } from '@/lib/db/schema/app'
import { cleanupCodebaseForWorkflow } from '../../common/cleanup-codebase'

export const saveAndEmbed = createStep({
  id: 'save-and-embed',
  description: 'Store analyzed content and generate embeddings',
  inputSchema: sanitizedContentSchema,
  outputSchema: sourceAnalysisOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { projectId, sourceId, sanitizedContent, hasContent, codebaseLeaseId } = inputData
    const logger = mastra?.getLogger()
    const errors: string[] = []
    let chunksEmbedded = 0

    try {
      if (!hasContent || !sanitizedContent) {
        await writer?.write({ type: 'progress', message: 'No content to save' })

        // Update source status to failed
        await db
          .update(knowledgeSources)
          .set({
            status: 'failed',
            error_message: 'No content extracted from source',
          })
          .where(eq(knowledgeSources.id, sourceId))

        return {
          projectId,
          sourceId,
          saved: false,
          chunksEmbedded: 0,
          errors: ['No content extracted'],
          codebaseLeaseId,
          codebaseCleanedUp: false,
        }
      }

      // 1. Save analyzed content directly to DB column
      await writer?.write({ type: 'progress', message: 'Saving analyzed content...' })

      try {
        await db
          .update(knowledgeSources)
          .set({
            status: 'done',
            analyzed_content: sanitizedContent,
            analyzed_at: new Date(),
            error_message: null,
          })
          .where(eq(knowledgeSources.id, sourceId))
      } catch (updateErr) {
        const msg = updateErr instanceof Error ? updateErr.message : 'Unknown error'
        errors.push(`DB update failed: ${msg}`)
        logger?.error('[save-and-embed] DB update failed:', { error: msg })
      }

      // 2. Generate embeddings
      if (errors.length === 0) {
        await writer?.write({ type: 'progress', message: 'Generating embeddings...' })

        const embedResult = await embedKnowledgeSource({
          id: sourceId,
          project_id: projectId,
          analyzed_content: sanitizedContent,
        })

        chunksEmbedded = embedResult.chunksEmbedded
        if (embedResult.errors.length > 0) {
          errors.push(...embedResult.errors)
        }

        await writer?.write({
          type: 'progress',
          message: `Embedded ${chunksEmbedded} chunks`,
        })
      }

      await writer?.write({ type: 'progress', message: 'Source analysis complete' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      errors.push(message)
      logger?.error('[save-and-embed] Error:', { error: message })

      // Update source status to failed
      try {
        await db
          .update(knowledgeSources)
          .set({
            status: 'failed',
            error_message: message,
          })
          .where(eq(knowledgeSources.id, sourceId))
      } catch {
        // Best effort
      }
    }

    // 3. Cleanup codebase lease if applicable
    let codebaseCleanedUp = false
    if (codebaseLeaseId) {
      codebaseCleanedUp = await cleanupCodebaseForWorkflow({
        codebaseLeaseId,
        logger: logger
          ? {
              info: (msg, data) => logger.info(msg, data),
              warn: (msg, data) => logger.warn(msg, data),
            }
          : undefined,
        writer: writer
          ? { write: async (data) => { await writer.write(data) } }
          : undefined,
      })
    }

    return {
      projectId,
      sourceId,
      saved: errors.length === 0,
      chunksEmbedded,
      errors,
      codebaseLeaseId,
      codebaseCleanedUp,
    }
  },
})
