/**
 * Feedback Tools for Support Agent (Slack Team Member Mode)
 *
 * Allows team members to record feedback on behalf of a contact
 * via Slack @mentions. Reuses the existing conversation session,
 * re-attributes it to the contact, and closes it for PM review.
 */

import type { ToolsInput } from '@mastra/core/agent'
import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { saveSessionMessage } from '@/lib/supabase/session-messages'
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

function getFeedbackContext(runtimeContext: unknown): FeedbackContext {
  if (!runtimeContext || typeof runtimeContext !== 'object') {
    return { projectId: null, sessionId: null, userId: null, userMetadata: null }
  }
  const ctx = runtimeContext as { get?: (key: string) => unknown }
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
  execute: async ({ context, runtimeContext }) => {
    const { projectId, sessionId, userId, userMetadata } = getFeedbackContext(runtimeContext)

    if (!projectId) {
      return { success: false, error: 'Project context not available.' }
    }
    if (!sessionId) {
      return { success: false, error: 'Session context not available. This tool can only be used within a conversation.' }
    }

    const { contactEmail, contactName, summary, details, feedbackType } = context

    try {
      const supabase = createAdminClient()

      // Guard against re-recording: check if session is already closed
      const { data: currentSession } = await supabase
        .from('sessions')
        .select('status')
        .eq('id', sessionId)
        .single()

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
        recorded_via: 'slack_team_member',
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
      const { error: updateError } = await supabase
        .from('sessions')
        .update({
          user_id: contactEmail.toLowerCase(),
          user_metadata: contactMetadata,
          name: summary,
          tags: [feedbackType],
          status: 'closed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionId)

      if (updateError) {
        console.error(`${LOG_PREFIX} Failed to update session`, updateError)
        return { success: false, error: 'Failed to update session.' }
      }

      // Save feedback content as a user message
      void saveSessionMessage({
        sessionId,
        projectId,
        senderType: 'user',
        content: details,
      })

      // Resolve/create contact and link to session
      const contactResult = await resolveContactForSession(supabase, {
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

export function buildFeedbackToolset(): ToolsInput {
  return Object.fromEntries(feedbackTools.map((t) => [t.id, t]))
}
