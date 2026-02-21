/**
 * Product Specification Tools
 *
 * Tools for gathering context and saving product specifications.
 * Used by the Spec Writer Agent to generate comprehensive specs from issues.
 */

import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { createAdminClient } from '@/lib/supabase/server'
import { triggerTrackerSyncForIssue } from '@/lib/integrations/issue-tracker'
import { getSessionMessages } from '@/lib/supabase/session-messages'
import { downloadKnowledgePackage } from '@/lib/knowledge/storage'
import type { IssueType, IssuePriority } from '@/types/issue'

/**
 * Gather all context needed to generate a product specification for an issue
 */
export const gatherProductSpecInfoTool = createTool({
  id: 'gather-product-spec-info',
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

      // Get messages for each session from session_messages table
      const sessionsWithMessages = []

      for (const isLink of issue.issue_sessions || []) {
        const sessionData = Array.isArray(isLink.session)
          ? isLink.session[0]
          : isLink.session

        if (!sessionData) continue

        const sessionMessages = await getSessionMessages(sessionData.id)
        const messages = sessionMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }))

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
          status: 'ready', // Auto-transition to ready when spec is generated
          updated_at: new Date().toISOString(),
        })
        .eq('id', issueId)

      if (error) {
        return {
          success: false,
          error: error.message,
        }
      }

      // Trigger Jira sync to add spec comment (fire-and-forget)
      const { data: issueData } = await supabase
        .from('issues')
        .select('project_id')
        .eq('id', issueId)
        .single()
      if (issueData?.project_id) {
        triggerTrackerSyncForIssue(issueId, issueData.project_id, 'update_spec')
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

// Export all spec tools as an array for easy registration
export const specTools = [gatherProductSpecInfoTool, saveProductSpecTool]
