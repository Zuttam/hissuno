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
import { createAdminClient } from '@/lib/supabase/server'
import { getSessionMessages } from '@/lib/supabase/session-messages'

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
      pmReviewedAt: z.string().nullable(),
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
  execute: async ({ context }) => {
    const { sessionId } = context

    try {
      const supabase = createAdminClient()

      // Get session with project info from Supabase
      const { data: session, error: sessionError } = await supabase
        .from('sessions')
        .select(`
          id,
          project_id,
          user_id,
          user_metadata,
          page_url,
          page_title,
          message_count,
          status,
          pm_reviewed_at,
          project:projects (
            id,
            name,
            description
          )
        `)
        .eq('id', sessionId)
        .single()

      if (sessionError || !session) {
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
            pmReviewedAt: null,
          },
          messages: [],
          project: { id: '', name: '', description: null },
          found: false,
          error: sessionError?.message ?? 'Session not found',
        }
      }

      // Get messages from session_messages table
      const messages = await getSessionMessages(sessionId)

      const project = Array.isArray(session.project)
        ? session.project[0]
        : session.project

      return {
        session: {
          id: session.id,
          projectId: session.project_id,
          userId: session.user_id,
          userMetadata: session.user_metadata as Record<string, string> | null,
          pageUrl: session.page_url,
          pageTitle: session.page_title,
          messageCount: session.message_count,
          status: session.status as 'active' | 'closed',
          pmReviewedAt: session.pm_reviewed_at,
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
          pmReviewedAt: null,
        },
        messages: [],
        project: { id: '', name: '', description: null },
        found: false,
        error: message,
      }
    }
  },
})

/**
 * Find similar issues for deduplication using semantic similarity
 */
export const findSimilarIssuesTool = createTool({
  id: 'find-similar-issues',
  description: `Search for existing issues semantically similar to the one being created.
Uses AI-powered semantic similarity to find potential duplicates.
Returns ranked list with similarity scores (0.7+ is a definitive match).`,
  inputSchema: z.object({
    projectId: z.string().describe('The project ID to search within'),
    title: z.string().describe('The proposed issue title'),
    description: z.string().describe('The proposed issue description'),
    type: z
      .enum(['bug', 'feature_request', 'change_request'])
      .describe('The issue type'),
    includeClosed: z
      .boolean()
      .optional()
      .describe('Include closed/resolved issues for regression detection'),
  }),
  outputSchema: z.object({
    similarIssues: z.array(
      z.object({
        issueId: z.string(),
        title: z.string(),
        description: z.string(),
        upvoteCount: z.number(),
        status: z.string(),
        similarityScore: z.number(),
        matchReason: z.string(),
      })
    ),
    hasSimilar: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { projectId, title, description, type, includeClosed = false } = context

    try {
      const { searchSimilarIssues } = await import('@/lib/issues/embedding-service')

      const results = await searchSimilarIssues(projectId, title, description, {
        type,
        limit: 5,
        threshold: 0.5, // Return anything above 50% for consideration
        includeClosed,
      })

      const scoredIssues = results.map((r) => {
        // Determine match reason based on semantic similarity
        let matchReason = 'Some similarity'
        if (r.similarity > 0.85) matchReason = 'Very high semantic similarity - likely duplicate'
        else if (r.similarity > 0.7) matchReason = 'High semantic similarity - probable duplicate'
        else if (r.similarity > 0.6) matchReason = 'Moderate similarity - related issue'
        else if (r.similarity > 0.5) matchReason = 'Some similarity - possibly related'

        return {
          issueId: r.issueId,
          title: r.title,
          description: r.description,
          upvoteCount: r.upvoteCount,
          status: r.status,
          similarityScore: Math.round(r.similarity * 100) / 100,
          matchReason,
        }
      })

      return {
        similarIssues: scoredIssues,
        hasSimilar: scoredIssues.some((i) => i.similarityScore >= 0.7),
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('[find-similar-issues] Error:', message)

      // Fall back to keyword-based search if embedding search fails
      try {
        const supabase = createAdminClient()
        const { data: issues } = await supabase
          .from('issues')
          .select('*')
          .eq('project_id', projectId)
          .eq('type', type)
          .in('status', ['open', 'in_progress'])
          .order('upvote_count', { ascending: false })
          .limit(10)

        if (!issues || issues.length === 0) {
          return { similarIssues: [], hasSimilar: false }
        }

        // Fallback to Jaccard similarity
        const newIssueText = `${title} ${description}`
        const scoredIssues = issues
          .map((issue) => {
            const existingText = `${issue.title} ${issue.description}`
            const score = calculateNaiveSimilarity(newIssueText, existingText)

            let matchReason = 'Low keyword overlap'
            if (score > 0.6) matchReason = 'Similar keywords'
            else if (score > 0.4) matchReason = 'Some keyword overlap'

            return {
              issueId: issue.id,
              title: issue.title,
              description: issue.description,
              upvoteCount: issue.upvote_count,
              status: issue.status,
              similarityScore: Math.round(score * 100) / 100,
              matchReason,
            }
          })
          .filter((i) => i.similarityScore > 0.3)
          .sort((a, b) => b.similarityScore - a.similarityScore)
          .slice(0, 5)

        return {
          similarIssues: scoredIssues,
          hasSimilar: scoredIssues.some((i) => i.similarityScore > 0.7),
        }
      } catch {
        return { similarIssues: [], hasSimilar: false, error: message }
      }
    }
  },
})

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Extract keywords from text for similarity matching
 * Removes common stop words and returns unique lowercase terms
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these',
    'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'what', 'which',
    'who', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'not', 'only',
    'same', 'so', 'than', 'too', 'very', 'just', 'also', 'now', 'want',
    'need', 'like', 'get', 'make', 'use', 'would', 'should', 'could',
  ])

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !stopWords.has(word))
    .filter((word, index, arr) => arr.indexOf(word) === index)
}

/**
 * Calculate Jaccard similarity between two texts
 */
function calculateNaiveSimilarity(text1: string, text2: string): number {
  const keywords1 = extractKeywords(text1)
  const keywords2 = extractKeywords(text2)

  if (keywords1.length === 0 || keywords2.length === 0) return 0

  const set1 = new Set(keywords1)
  const set2 = new Set(keywords2)

  const intersection = [...set1].filter((k) => set2.has(k))
  const union = new Set([...set1, ...set2])

  return intersection.length / union.size
}

// Export all tools as an array for easy registration
export const issueTools = [
  getSessionContextTool,
  findSimilarIssuesTool,
]
