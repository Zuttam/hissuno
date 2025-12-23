/**
 * Issue Tools for Product Manager Agent
 *
 * These tools allow the PM agent to:
 * 1. Analyze sessions for actionable feedback
 * 2. Find similar existing issues to avoid duplicates
 * 3. Create new issues or upvote existing ones
 * 4. Generate product specs when threshold is reached
 *
 * NOTE: These tools expect `projectId` to be available in the RuntimeContext.
 */

import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { mastra } from '@/mastra'
import type {
  IssueType,
  IssuePriority,
} from '@/types/issue'
import type { ChatMessage } from '@/types/session'
import { downloadKnowledgePackage } from '@/lib/knowledge/storage'
import { parseMastraMessages } from '@/lib/utils/mastra/parse-messages'

/**
 * Helper to get projectId from runtimeContext with validation
 */
function getProjectIdFromContext(runtimeContext: unknown): string | null {
  if (!runtimeContext || typeof runtimeContext !== 'object') {
    return null
  }
  const ctx = runtimeContext as { get?: (key: string) => unknown }
  if (typeof ctx.get !== 'function') {
    return null
  }
  const projectId = ctx.get('projectId')
  return typeof projectId === 'string' ? projectId : null
}

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
function calculateSimilarity(text1: string, text2: string): number {
  const keywords1 = extractKeywords(text1)
  const keywords2 = extractKeywords(text2)

  if (keywords1.length === 0 || keywords2.length === 0) return 0

  const set1 = new Set(keywords1)
  const set2 = new Set(keywords2)

  const intersection = [...set1].filter((k) => set2.has(k))
  const union = new Set([...set1, ...set2])

  return intersection.length / union.size
}

/**
 * Calculate priority based on upvote count
 */
function calculatePriority(upvoteCount: number): IssuePriority {
  if (upvoteCount >= 5) return 'high'
  if (upvoteCount >= 3) return 'medium'
  return 'low'
}

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

      // Get messages from Mastra storage
      const storage = mastra.getStorage()
      let messages: ChatMessage[] = []

      if (storage) {
        try {
          const mastraMessages = await storage.getMessages({ threadId: sessionId })
          messages = parseMastraMessages(mastraMessages)
        } catch {
          // Storage might not have messages for this session
        }
      }

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
 * Find similar issues for deduplication
 */
export const findSimilarIssuesTool = createTool({
  id: 'find-similar-issues',
  description: `Search for existing issues similar to the one being created.
Returns ranked list of potential duplicates with similarity scores.
Use this before creating a new issue to check for duplicates.`,
  inputSchema: z.object({
    projectId: z.string().describe('The project ID to search within'),
    title: z.string().describe('The proposed issue title'),
    description: z.string().describe('The proposed issue description'),
    type: z
      .enum(['bug', 'feature_request', 'change_request'])
      .describe('The issue type'),
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
    const { projectId, title, description, type } = context

    try {
      const supabase = createAdminClient()

      // Get open/in_progress issues of the same type for this project
      const { data: issues, error } = await supabase
        .from('issues')
        .select('*')
        .eq('project_id', projectId)
        .eq('type', type)
        .in('status', ['open', 'in_progress'])
        .order('upvote_count', { ascending: false })

      if (error) {
        return {
          similarIssues: [],
          hasSimilar: false,
          error: `Failed to search issues: ${error.message}`,
        }
      }

      if (!issues || issues.length === 0) {
        return {
          similarIssues: [],
          hasSimilar: false,
        }
      }

      // Calculate similarity for each issue
      const newIssueText = `${title} ${description}`
      const scoredIssues = issues
        .map((issue) => {
          const existingText = `${issue.title} ${issue.description}`
          const score = calculateSimilarity(newIssueText, existingText)

          // Determine match reason
          let matchReason = 'Low similarity'
          if (score > 0.8) matchReason = 'Very similar title and description'
          else if (score > 0.6) matchReason = 'Similar description'
          else if (score > 0.4) matchReason = 'Some keyword overlap'
          else if (score > 0.3) matchReason = 'Minor keyword overlap'

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
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        similarIssues: [],
        hasSimilar: false,
        error: message,
      }
    }
  },
})

/**
 * Create a new issue from session analysis
 */
export const createIssueTool = createTool({
  id: 'create-issue',
  description: `Create a new issue from session analysis.
Links the session to the issue and sets initial priority.
Only use this after confirming no similar issues exist.`,
  inputSchema: z.object({
    projectId: z.string().describe('The project ID'),
    sessionId: z.string().describe('The originating session ID'),
    type: z
      .enum(['bug', 'feature_request', 'change_request'])
      .describe('The issue type'),
    title: z.string().max(200).describe('Concise issue title'),
    description: z.string().describe('Detailed issue description'),
    suggestedPriority: z
      .enum(['low', 'medium', 'high'])
      .optional()
      .describe('Suggested priority based on user sentiment'),
  }),
  outputSchema: z.object({
    issueId: z.string(),
    success: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { projectId, sessionId, type, title, description, suggestedPriority } =
      context

    try {
      const supabase = createAdminClient()

      // Create the issue
      const { data: issue, error: issueError } = await supabase
        .from('issues')
        .insert({
          project_id: projectId,
          type,
          title,
          description,
          priority: suggestedPriority ?? 'low',
          upvote_count: 1,
          status: 'open',
        })
        .select('id')
        .single()

      if (issueError || !issue) {
        return {
          issueId: '',
          success: false,
          error: issueError?.message ?? 'Failed to create issue',
        }
      }

      // Link the session to the issue
      const { error: linkError } = await supabase.from('issue_sessions').insert({
        issue_id: issue.id,
        session_id: sessionId,
      })

      if (linkError) {
        // Issue was created but linking failed - log but don't fail
        console.error('Failed to link session to issue:', linkError)
      }

      // Mark session as PM reviewed
      await supabase
        .from('sessions')
        .update({ pm_reviewed_at: new Date().toISOString() })
        .eq('id', sessionId)

      return {
        issueId: issue.id,
        success: true,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        issueId: '',
        success: false,
        error: message,
      }
    }
  },
})

/**
 * Upvote an existing issue and link a new session
 */
export const upvoteIssueTool = createTool({
  id: 'upvote-issue',
  description: `Upvote an existing issue when a similar concern is raised.
Links the new session, increments upvote count, and updates priority if not manually overridden.
Returns whether the spec generation threshold was met.`,
  inputSchema: z.object({
    issueId: z.string().describe('The issue ID to upvote'),
    sessionId: z.string().describe('The session ID to link'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    newUpvoteCount: z.number(),
    newPriority: z.enum(['low', 'medium', 'high']),
    thresholdMet: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { issueId, sessionId } = context

    try {
      const supabase = createAdminClient()

      // Get current issue state
      const { data: issue, error: issueError } = await supabase
        .from('issues')
        .select('*, project:projects(id)')
        .eq('id', issueId)
        .single()

      if (issueError || !issue) {
        return {
          success: false,
          newUpvoteCount: 0,
          newPriority: 'low' as const,
          thresholdMet: false,
          error: issueError?.message ?? 'Issue not found',
        }
      }

      // Calculate new values
      const newUpvoteCount = (issue.upvote_count ?? 1) + 1
      const newPriority = issue.priority_manual_override
        ? (issue.priority as IssuePriority)
        : calculatePriority(newUpvoteCount)

      // Update the issue
      const { error: updateError } = await supabase
        .from('issues')
        .update({
          upvote_count: newUpvoteCount,
          priority: newPriority,
          updated_at: new Date().toISOString(),
        })
        .eq('id', issueId)

      if (updateError) {
        return {
          success: false,
          newUpvoteCount: 0,
          newPriority: 'low' as const,
          thresholdMet: false,
          error: updateError.message,
        }
      }

      // Link session to issue (ignore if already linked)
      await supabase
        .from('issue_sessions')
        .insert({ issue_id: issueId, session_id: sessionId })
        .select()
        .maybeSingle()

      // Mark session as PM reviewed
      await supabase
        .from('sessions')
        .update({ pm_reviewed_at: new Date().toISOString() })
        .eq('id', sessionId)

      // Get project settings for threshold
      const { data: settings } = await supabase
        .from('project_settings')
        .select('issue_spec_threshold')
        .eq('project_id', issue.project_id)
        .single()

      const threshold = settings?.issue_spec_threshold ?? 3
      const thresholdMet = newUpvoteCount >= threshold && !issue.product_spec

      return {
        success: true,
        newUpvoteCount,
        newPriority,
        thresholdMet,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        newUpvoteCount: 0,
        newPriority: 'low' as const,
        thresholdMet: false,
        error: message,
      }
    }
  },
})

/**
 * Generate a product specification for an issue
 */
export const generateProductSpecTool = createTool({
  id: 'generate-product-spec',
  description: `Gather all context needed to generate a product specification for an issue.
Retrieves the issue details, all linked sessions with messages, and project knowledge.
Use this data to generate a comprehensive product spec.`,
  inputSchema: z.object({
    issueId: z.string().describe('The issue ID to generate a spec for'),
  }),
  outputSchema: z.object({
    issue: z.object({
      id: z.string(),
      title: z.string(),
      description: z.string(),
      type: z.enum(['bug', 'feature_request', 'change_request']),
      upvoteCount: z.number(),
      priority: z.enum(['low', 'medium', 'high']),
    }),
    sessions: z.array(
      z.object({
        id: z.string(),
        pageUrl: z.string().nullable(),
        userMetadata: z.record(z.string()).nullable(),
        messages: z.array(
          z.object({
            role: z.enum(['user', 'assistant', 'system']),
            content: z.string(),
          })
        ),
      })
    ),
    project: z.object({
      id: z.string(),
      name: z.string(),
      description: z.string().nullable(),
    }),
    knowledge: z.object({
      product: z.string().nullable(),
      technical: z.string().nullable(),
    }),
    found: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { issueId } = context

    try {
      const supabase = createAdminClient()

      // Get issue with linked sessions
      const { data: issue, error: issueError } = await supabase
        .from('issues')
        .select(`
          *,
          project:projects (
            id,
            name,
            description
          ),
          issue_sessions (
            session:sessions (
              id,
              page_url,
              user_metadata
            )
          )
        `)
        .eq('id', issueId)
        .single()

      if (issueError || !issue) {
        return {
          issue: {
            id: '',
            title: '',
            description: '',
            type: 'bug' as const,
            upvoteCount: 0,
            priority: 'low' as const,
          },
          sessions: [],
          project: { id: '', name: '', description: null },
          knowledge: { product: null, technical: null },
          found: false,
          error: issueError?.message ?? 'Issue not found',
        }
      }

      const project = Array.isArray(issue.project)
        ? issue.project[0]
        : issue.project

      // Get messages for each session from Mastra storage
      const storage = mastra.getStorage()
      const sessionsWithMessages = []

      for (const isLink of issue.issue_sessions || []) {
        const sessionData = Array.isArray(isLink.session)
          ? isLink.session[0]
          : isLink.session

        if (!sessionData) continue

        let messages: { role: 'user' | 'assistant' | 'system'; content: string }[] =
          []

        if (storage) {
          try {
            const mastraMessages = await storage.getMessages({ threadId: sessionData.id })
            messages = parseMastraMessages(mastraMessages).map((m) => ({
              role: m.role,
              content: m.content,
            }))
          } catch {
            // Storage might not have messages for this session
          }
        }

        sessionsWithMessages.push({
          id: sessionData.id,
          pageUrl: sessionData.page_url,
          userMetadata: sessionData.user_metadata as Record<string, string> | null,
          messages,
        })
      }

      // Get project knowledge packages
      let productKnowledge: string | null = null
      let technicalKnowledge: string | null = null

      const { data: packages } = await supabase
        .from('knowledge_packages')
        .select('category, storage_path')
        .eq('project_id', project?.id)
        .in('category', ['product', 'technical'])

      if (packages) {
        for (const pkg of packages) {
          const { content } = await downloadKnowledgePackage(
            pkg.storage_path,
            supabase
          )
          if (pkg.category === 'product') productKnowledge = content ?? null
          if (pkg.category === 'technical') technicalKnowledge = content ?? null
        }
      }

      return {
        issue: {
          id: issue.id,
          title: issue.title,
          description: issue.description,
          type: issue.type as IssueType,
          upvoteCount: issue.upvote_count,
          priority: issue.priority as IssuePriority,
        },
        sessions: sessionsWithMessages,
        project: {
          id: project?.id ?? '',
          name: project?.name ?? '',
          description: project?.description ?? null,
        },
        knowledge: {
          product: productKnowledge,
          technical: technicalKnowledge,
        },
        found: true,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        issue: {
          id: '',
          title: '',
          description: '',
          type: 'bug' as const,
          upvoteCount: 0,
          priority: 'low' as const,
        },
        sessions: [],
        project: { id: '', name: '', description: null },
        knowledge: { product: null, technical: null },
        found: false,
        error: message,
      }
    }
  },
})

/**
 * Save a generated product spec to an issue
 */
export const saveProductSpecTool = createTool({
  id: 'save-product-spec',
  description: `Save a generated product specification to an issue.
Call this after generating the spec content.`,
  inputSchema: z.object({
    issueId: z.string().describe('The issue ID to save the spec to'),
    spec: z.string().describe('The generated product specification (markdown)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { issueId, spec } = context

    try {
      const supabase = createAdminClient()

      const { error } = await supabase
        .from('issues')
        .update({
          product_spec: spec,
          product_spec_generated_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', issueId)

      if (error) {
        return {
          success: false,
          error: error.message,
        }
      }

      return { success: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      return {
        success: false,
        error: message,
      }
    }
  },
})

// Export all tools as an array for easy registration
export const issueTools = [
  getSessionContextTool,
  findSimilarIssuesTool,
  createIssueTool,
  upvoteIssueTool,
  generateProductSpecTool,
  saveProductSpecTool,
]
