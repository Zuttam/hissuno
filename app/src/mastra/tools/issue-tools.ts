/**
 * Issue Tools for Product Manager Agent
 *
 * These tools allow the PM agent to:
 * 1. Get session context for analysis
 * 2. Find similar existing issues to avoid duplicates
 *
 * NOTE: Issue create/upvote/mark-reviewed operations are handled by the
 * execute-decision workflow step, not by agent tools. This ensures
 * deterministic execution and avoids duplication of logic.
 */

import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { sessions, projects } from '@/lib/db/schema/app'
import { getSessionMessages } from '@/lib/db/queries/session-messages'

/**
 * Get session context including messages from Mastra storage
 */
export const getSessionContextTool = createTool({
  id: 'get-session-context',
  description: `Get full context for a session including all messages and metadata.
Use this to retrieve the conversation history before analyzing a session.`,
  inputSchema: z.object({
    sessionId: z.string().describe('The session ID to retrieve'),
  }),
  outputSchema: z.object({
    session: z.object({
      id: z.string(),
      projectId: z.string(),
      userId: z.string().nullable(),
      userMetadata: z.record(z.string()).nullable(),
      pageUrl: z.string().nullable(),
      pageTitle: z.string().nullable(),
      messageCount: z.number(),
      status: z.enum(['active', 'closed']),
    }),
    messages: z.array(z.object({
      role: z.enum(['user', 'assistant', 'system']),
      content: z.string(),
      createdAt: z.string(),
    })),
    project: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
    }),
    found: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async (context) => {
    const { sessionId } = context

    try {
      // Get session with project info
      const [session] = await db
        .select({
          id: sessions.id,
          project_id: sessions.project_id,
          user_metadata: sessions.user_metadata,
          page_url: sessions.page_url,
          page_title: sessions.page_title,
          message_count: sessions.message_count,
          status: sessions.status,
        })
        .from(sessions)
        .where(eq(sessions.id, sessionId))

      if (!session) {
        return {
          session: {
            id: '',
            projectId: '',
            userId: null,
            userMetadata: null,
            pageUrl: null,
            pageTitle: null,
            messageCount: 0,
            status: 'closed' as const,
          },
          messages: [],
          project: { id: '', name: '', description: null },
          found: false,
          error: 'Session not found',
        }
      }

      // Get project info
      const [project] = await db
        .select({
          id: projects.id,
          name: projects.name,
          description: projects.description,
        })
        .from(projects)
        .where(eq(projects.id, session.project_id))

      // Get messages from session_messages table
      const messages = await getSessionMessages(sessionId)

      return {
        session: {
          id: session.id,
          projectId: session.project_id,
          userId: (session.user_metadata as Record<string, string> | null)?.userId || null,
          userMetadata: session.user_metadata as Record<string, string> | null,
          pageUrl: session.page_url,
          pageTitle: session.page_title,
          messageCount: session.message_count ?? 0,
          status: (session.status as 'active' | 'closed') ?? 'closed',
        },
        messages,
        project: {
          id: project?.id ?? '',
          name: project?.name ?? '',
          description: project?.description ?? null,
        },
        found: true,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        session: {
          id: '',
          projectId: '',
          userId: null,
          userMetadata: null,
          pageUrl: null,
          pageTitle: null,
          messageCount: 0,
          status: 'closed' as const,
        },
        messages: [],
        project: { id: '', name: '', description: null },
        found: false,
        error: message,
      }
    }
  },
})

// Removed: findSimilarIssuesTool, helpers, and the issueTools array - they

