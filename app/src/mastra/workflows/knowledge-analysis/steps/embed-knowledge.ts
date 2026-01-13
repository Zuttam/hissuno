/**
 * Step 6: Embed Knowledge Packages
 *
 * Generates vector embeddings for all knowledge packages using OpenAI's
 * text-embedding-3-small model. These embeddings enable semantic search
 * across the knowledge base.
 */

import { createStep } from '@mastra/core/workflows'
import { workflowOutputSchema, workflowWithEmbeddingOutputSchema } from '../schemas'

export const embedKnowledge = createStep({
  id: 'embed-knowledge',
  description: 'Generate vector embeddings for semantic search',
  inputSchema: workflowOutputSchema,
  outputSchema: workflowWithEmbeddingOutputSchema,
  execute: async ({ inputData, getInitData, writer }) => {
    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { saved, packages } = inputData

    // Skip if nothing was saved
    if (!saved || packages.length === 0) {
      await writer?.write({
        type: 'progress',
        message: 'Skipping embedding (no packages to embed)',
      })
      return {
        ...inputData,
        embedding: {
          success: true,
          chunksEmbedded: 0,
          embeddingErrors: [],
        },
      }
    }

    await writer?.write({
      type: 'progress',
      message: 'Generating semantic embeddings for knowledge search...',
    })

    const initData = getInitData?.() as { projectId: string } | undefined
    const projectId = initData?.projectId

    if (!projectId) {
      return {
        ...inputData,
        embedding: {
          success: false,
          chunksEmbedded: 0,
          embeddingErrors: ['Project ID not found in workflow context'],
        },
      }
    }

    try {
      // Dynamic import to avoid issues in workflow context
      const { embedProjectKnowledge } = await import('@/lib/knowledge/embedding-service')

      const result = await embedProjectKnowledge(projectId)

      await writer?.write({
        type: 'progress',
        message: result.success
          ? `Embedded ${result.chunksEmbedded} chunks for semantic search`
          : `Embedding partially failed: ${result.errors.length} errors`,
      })

      // Update project_analyses metadata with embedding info
      try {
        const { createAdminClient } = await import('@/lib/supabase/server')
        const supabase = createAdminClient()
        const analysisId = (initData as { analysisId?: string } | undefined)?.analysisId

        if (analysisId) {
          // Get current metadata and merge embedding results
          const { data: analysisRecord } = await supabase
            .from('project_analyses')
            .select('metadata')
            .eq('id', analysisId)
            .single()

          const existingMetadata = (analysisRecord?.metadata as Record<string, unknown>) ?? {}

          await supabase
            .from('project_analyses')
            .update({
              metadata: {
                ...existingMetadata,
                embeddingResult: {
                  success: result.success,
                  chunksEmbedded: result.chunksEmbedded,
                  errors: result.errors.length > 0 ? result.errors : undefined,
                },
              },
            })
            .eq('id', analysisId)
        }
      } catch (updateError) {
        console.error('[embed-knowledge] Failed to update analysis metadata:', updateError)
      }

      return {
        ...inputData,
        embedding: {
          success: result.success,
          chunksEmbedded: result.chunksEmbedded,
          embeddingErrors: result.errors,
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[embed-knowledge] Failed to embed knowledge:', message)

      await writer?.write({
        type: 'progress',
        message: `Embedding failed: ${message}`,
      })

      return {
        ...inputData,
        embedding: {
          success: false,
          chunksEmbedded: 0,
          embeddingErrors: [message],
        },
      }
    }
  },
})
