/**
 * Step: Prepare PM Context
 *
 * Deterministic step that fetches session data, messages, and project settings
 * needed for PM review analysis.
 */

import { createStep } from '@mastra/core/workflows'
import { createAdminClient } from '@/lib/supabase/server'
import { getSessionMessages } from '@/lib/supabase/session-messages'
import { classifyOutputSchema, preparedPMContextSchema } from '../schemas'

export const preparePMContext = createStep({
  id: 'prepare-pm-context',
  description: 'Fetch session data and project settings for PM review',
  inputSchema: classifyOutputSchema,
  outputSchema: preparedPMContextSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { sessionId, projectId, tags, tagsApplied, reasoning, localCodePath, codebaseLeaseId, codebaseCommitSha } = inputData
    logger?.info('[prepare-pm-context] Starting', { sessionId, projectId })
    await writer?.write({ type: 'progress', message: 'Fetching session context...' })

    const supabase = createAdminClient()

    // Fetch session data
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select(
        `
        id,
        user_id,
        user_metadata,
        page_url,
        page_title,
        message_count,
        status
      `
      )
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      throw new Error(`Failed to fetch session: ${sessionError?.message ?? 'Not found'}`)
    }

    // Fetch messages
    const messages = await getSessionMessages(sessionId)

    // Fetch project settings
    const { data: settings } = await supabase
      .from('project_settings')
      .select('issue_tracking_enabled, issue_spec_threshold, pm_dedup_include_closed')
      .eq('project_id', projectId)
      .single()

    await writer?.write({
      type: 'progress',
      message: `Loaded ${messages.length} messages`,
    })

    logger?.info('[prepare-pm-context] Completed', {
      messageCount: messages.length,
      hasSettings: !!settings,
    })

    return {
      sessionId,
      projectId,
      tags,
      tagsApplied,
      reasoning,
      session: {
        id: session.id,
        userId: session.user_id,
        userMetadata: session.user_metadata as Record<string, string> | null,
        pageUrl: session.page_url,
        pageTitle: session.page_title,
        messageCount: session.message_count,
        status: session.status,
      },
      messages: messages.map((m) => ({
        role: m.role,
        content: m.content,
        createdAt: m.createdAt,
      })),
      settings: {
        issueTrackingEnabled: settings?.issue_tracking_enabled ?? true,
        issueSpecThreshold: settings?.issue_spec_threshold ?? 3,
        pmDedupIncludeClosed: settings?.pm_dedup_include_closed ?? false,
      },
      // Pass through codebase lease fields
      localCodePath,
      codebaseLeaseId,
      codebaseCommitSha,
    }
  },
})
