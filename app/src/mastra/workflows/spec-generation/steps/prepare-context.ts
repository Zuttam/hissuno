/**
 * Step: Prepare Context
 *
 * Gathers all context needed for spec generation:
 * - Issue details (type, title, description)
 * - Linked sessions and their user messages
 * - Relevant knowledge from knowledge packages
 */

import { createStep } from '@mastra/core/workflows'
import { createAdminClient } from '@/lib/supabase/server'
import { workflowContextWithCodebaseSchema, preparedContextSchema } from '../schemas'

export const prepareContext = createStep({
  id: 'prepare-context',
  description: 'Gather issue context, linked feedback sessions, and knowledge for spec generation',
  inputSchema: workflowContextWithCodebaseSchema,
  outputSchema: preparedContextSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { issueId, projectId, localCodePath, codebaseLeaseId, codebaseCommitSha } = inputData
    logger?.info('[prepare-context] Starting', { issueId, projectId })
    await writer?.write({ type: 'progress', message: 'Gathering issue context...' })

    const supabase = createAdminClient()

    // Fetch issue details
    const { data: issue, error: issueError } = await supabase
      .from('issues')
      .select('id, type, title, description, priority, upvote_count, status')
      .eq('id', issueId)
      .single()

    if (issueError || !issue) {
      throw new Error(`Failed to fetch issue: ${issueError?.message ?? 'Not found'}`)
    }

    await writer?.write({ type: 'progress', message: 'Fetching linked sessions...' })

    // Fetch sessions that upvoted this issue (contributing sessions)
    const { data: contributingSessions } = await supabase
      .from('issue_upvotes')
      .select('session_id')
      .eq('issue_id', issueId)

    const sessionIds = contributingSessions?.map(s => s.session_id).filter(Boolean) ?? []

    // Fetch user messages from linked feedback sessions
    const linkedSessions: Array<{ id: string; userMessages: string[] }> = []

    for (const sessionId of sessionIds.slice(0, 5)) { // Limit to 5 sessions for context
      if (!sessionId) continue

      const { data: messages } = await supabase
        .from('session_messages')
        .select('content')
        .eq('session_id', sessionId)
        .eq('role', 'user')
        .order('created_at', { ascending: true })
        .limit(10)

      if (messages && messages.length > 0) {
        linkedSessions.push({
          id: sessionId,
          userMessages: messages.map(m => m.content),
        })
      }
    }

    await writer?.write({ type: 'progress', message: 'Loading knowledge context...' })

    // Fetch knowledge packages for context
    let knowledgeContext = ''
    const { data: packages } = await supabase
      .from('knowledge_packages')
      .select('category, storage_path')
      .eq('project_id', projectId)

    if (packages && packages.length > 0) {
      // Get relevant knowledge from the technical and product packages
      const relevantCategories = ['product', 'technical']
      for (const pkg of packages) {
        if (relevantCategories.includes(pkg.category)) {
          try {
            const { data: content } = await supabase.storage
              .from('knowledge-packages')
              .download(pkg.storage_path)

            if (content) {
              const text = await content.text()
              // Take first 5000 chars from each relevant package
              knowledgeContext += `\n## ${pkg.category} Knowledge\n${text.slice(0, 5000)}\n`
            }
          } catch (error) {
            logger?.warn('[prepare-context] Failed to load knowledge package', {
              category: pkg.category,
              error: error instanceof Error ? error.message : 'Unknown',
            })
          }
        }
      }
    }

    await writer?.write({
      type: 'progress',
      message: `Context prepared: ${linkedSessions.length} linked feedback`,
    })

    logger?.info('[prepare-context] Completed', {
      linkedSessionCount: linkedSessions.length,
      hasKnowledge: knowledgeContext.length > 0,
    })

    return {
      issueId,
      projectId,
      runId: inputData.runId,
      localCodePath,
      codebaseLeaseId,
      codebaseCommitSha,
      issue: {
        id: issue.id,
        type: issue.type,
        title: issue.title,
        description: issue.description ?? '',
        priority: issue.priority,
        upvoteCount: issue.upvote_count,
        status: issue.status,
      },
      linkedSessions,
      knowledgeContext,
    }
  },
})
