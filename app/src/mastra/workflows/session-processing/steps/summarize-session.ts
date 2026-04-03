/**
 * Step: Summarize Session
 *
 * Generates an improved session name and description using the
 * classification tags as context. Runs after classify-session.
 */

import { createStep } from '@mastra/core/workflows'
import { generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'
import { classifyOutputSchema, summarizeOutputSchema } from '../schemas'
import { getSessionMessages } from '@/lib/db/queries/session-messages'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { sessions } from '@/lib/db/schema/app'
import { fireEmbedding } from '@/lib/utils/embeddings'
import { buildSessionEmbeddingText } from '@/lib/sessions/embedding-service'

export const summarizeSession = createStep({
  id: 'summarize-session',
  description: 'Generate improved session name and description',
  inputSchema: classifyOutputSchema,
  outputSchema: summarizeOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { sessionId, projectId, tags, tagsApplied, reasoning, productScopeId } = inputData

    logger?.info('[summarize-session] Starting', { sessionId })
    await writer?.write({ type: 'progress', message: 'Generating summary...' })

    // Fetch messages once -- passed downstream so prepare-pm-context skips refetching
    const chatMessages = await getSessionMessages(sessionId)
    const mappedMessages = chatMessages.map((m) => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    }))

    if (chatMessages.length === 0) {
      logger?.warn('[summarize-session] No messages found', { sessionId })
      return {
        ...inputData,
        name: 'Empty Feedback',
        description: '',
        messages: [],
      }
    }

    try {

      // Build conversation text (limit to avoid token bloat)
      const MAX_MESSAGES_FOR_SUMMARY = 30
      const conversationText = chatMessages
        .slice(0, MAX_MESSAGES_FOR_SUMMARY)
        .map((m) => `${m.role}: ${m.content}`)
        .join('\n')

      const tagsStr = tags.length > 0 ? tags.join(', ') : 'none'

      const { object } = await generateObject({
        model: openai('gpt-5.4-mini'),
        schema: z.object({
          title: z.string().describe('Concise title, max 8 words, capturing the core feedback topic'),
          description: z
            .string()
            .describe('2-3 sentence summary: what was reported/requested, key context, severity if apparent'),
        }),
        prompt: `You are summarizing a customer feedback conversation tagged as [${tagsStr}].

Conversation:
${conversationText}

Generate a concise title (max 8 words) and a 2-3 sentence description summarizing this feedback. Focus on what the customer reported or requested, include key context, and note severity/impact if apparent.`,
      })

      // Save to DB
      await db
        .update(sessions)
        .set({
          name: object.title,
          description: object.description,
        })
        .where(eq(sessions.id, sessionId))

      // Fire-and-forget: generate embedding for semantic search
      fireEmbedding(sessionId, 'session', projectId, buildSessionEmbeddingText(object.title, object.description))

      logger?.info('[summarize-session] Complete', { sessionId, title: object.title })
      await writer?.write({ type: 'progress', message: `Summary: ${object.title}` })

      return {
        ...inputData,
        name: object.title,
        description: object.description,
        messages: mappedMessages,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger?.error('[summarize-session] Failed', { sessionId, error: message })

      // Non-fatal: pass messages through even on summary failure
      return {
        ...inputData,
        name: '',
        description: '',
        messages: mappedMessages,
      }
    }
  },
})
