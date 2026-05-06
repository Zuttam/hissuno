/**
 * Feedback Tools for Hissuno Agent (Team Member Mode)
 *
 * Allows team members to record feedback on behalf of a contact.
 * Reuses the existing conversation session, re-attributes it to
 * the contact, and closes it for PM review.
 */

import type { ToolsInput } from '@mastra/core/agent'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { sessions } from '@/lib/db/schema/app'
import { saveSessionMessage } from '@/lib/db/queries/session-messages'
import { resolveContactForSession } from '@/lib/customers/contact-resolution'

const LOG_PREFIX = '[feedback-tools]'

// ============================================================================
// Context Helper
// ============================================================================

interface FeedbackContext {
  projectId: string | null
  sessionId: string | null
  userId: string | null
  userMetadata: Record<string, string> | null
}

function getFeedbackContext(requestContext: unknown): FeedbackContext {
  if (!requestContext || typeof requestContext !== 'object') {
    return { projectId: null, sessionId: null, userId: null, userMetadata: null }
  }
  const ctx = requestContext as { get?: (key: string) => unknown }
  if (typeof ctx.get !== 'function') {
    return { projectId: null, sessionId: null, userId: null, userMetadata: null }
  }
  const projectId = ctx.get('projectId')
  const sessionId = ctx.get('sessionId')
  const userId = ctx.get('userId')
  const userMetadata = ctx.get('userMetadata')
  return {
    projectId: typeof projectId === 'string' ? projectId : null,
    sessionId: typeof sessionId === 'string' ? sessionId : null,
    userId: typeof userId === 'string' ? userId : null,
    userMetadata: userMetadata && typeof userMetadata === 'object' ? (userMetadata as Record<string, string>) : null,
  }
}

// ============================================================================
// record-feedback
// ============================================================================

export const recordFeedbackTool = createTool({
  id: 'record-feedback',
  description: `Record feedback on behalf of a contact (team member only).
Re-attributes the current conversation session to the specified contact, saves the feedback content, and closes the session for PM review.
Use when a team member says "record feedback from [person]" or similar.`,
  inputSchema: z.object({
    contactName: z.string().optional().describe("Contact's full name (optional)"),
    contactEmail: z.string().describe("Contact's email address for matching/creating contact"),
    summary: z.string().describe('One-line summary of the feedback (becomes the session name)'),
    details: z.string().describe('Detailed feedback content'),
    feedbackType: z
      .enum(['bug', 'feature_request', 'change_request', 'general_feedback'])
      .describe('Type of feedback being recorded'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    sessionId: z.string().optional(),
    contactId: z.string().nullable().optional(),
    contactCreated: z.boolean().optional(),
    error: z.string().optional(),
  }),
  execute: async (context, { requestContext }) => {
    const { projectId, sessionId, userId, userMetadata } = getFeedbackContext(requestContext)

    if (!projectId) {
      return { success: false, error: 'Project context not available.' }
    }
    if (!sessionId) {
      return { success: false, error: 'Session context not available. This tool can only be used within a conversation.' }
    }

    const { contactEmail, contactName, summary, details, feedbackType } = context

    try {
      // Guard against re-recording: check if session is already closed
      const [currentSession] = await db
        .select({ status: sessions.status, source: sessions.source })
        .from(sessions)
        .where(eq(sessions.id, sessionId))

      if (currentSession?.status === 'closed') {
        return {
          success: false,
          error: 'This session has already been closed and recorded. Please start a new thread to record additional feedback.',
        }
      }

      // Build contact metadata
      const teamMemberEmail = userMetadata?.email ?? userId ?? 'unknown'
      const teamMemberName = userMetadata?.name ?? userMetadata?.display_name ?? 'Team Member'

      const contactMetadata: Record<string, string> = {
        email: contactEmail.toLowerCase(),
        recorded_via: `${currentSession?.source ?? 'unknown'}_team_member`,
        recorded_by: teamMemberEmail,
        recorded_by_name: teamMemberName,
      }
      if (contactName) {
        contactMetadata.name = contactName
      }

      console.log(`${LOG_PREFIX} Recording feedback`, {
        sessionId,
        contactEmail,
        feedbackType,
        summary,
      })

      // Update session: re-attribute to contact, set metadata, close for PM review
      await db
        .update(sessions)
        .set({
          user_metadata: { ...contactMetadata, userId: contactEmail.toLowerCase() },
          name: summary,
          tags: [feedbackType],
          status: 'closed',
          updated_at: new Date(),
        })
        .where(eq(sessions.id, sessionId))

      // Save feedback content as a user message
      void saveSessionMessage({
        sessionId,
        projectId,
        senderType: 'user',
        content: details,
      })

      // Resolve/create contact and link to session
      const contactResult = await resolveContactForSession({
        projectId,
        sessionId,
        userMetadata: contactMetadata,
      })

      console.log(`${LOG_PREFIX} Feedback recorded successfully`, {
        sessionId,
        contactId: contactResult.contactId,
        contactCreated: contactResult.created,
      })

      return {
        success: true,
        sessionId,
        contactId: contactResult.contactId,
        contactCreated: contactResult.created,
      }
    } catch (error) {
      console.error(`${LOG_PREFIX} Unexpected error recording feedback`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  },
})

// ============================================================================
// Exports
// ============================================================================

export const feedbackTools = [recordFeedbackTool]

export function buildFeedbackToolset(contactId: string | null): ToolsInput {
  if (contactId) {
    return {} // Contacts don't get feedback recording tools
  }
  return Object.fromEntries(feedbackTools.map((t) => [t.id, t])) // Team members do
}
