/**
 * Step: Prepare PM Context
 *
 * Deterministic step that fetches session data, messages, and project settings
 * needed for PM review analysis.
 */

import { createStep } from '@mastra/core/workflows'
import { db } from '@/lib/db'
import { eq, and, isNotNull } from 'drizzle-orm'
import { sessions, projectSettings, productScopes, entityRelationships } from '@/lib/db/schema/app'
import { summarizeOutputSchema, preparedPMContextSchema } from '../schemas'

export const preparePMContext = createStep({
  id: 'prepare-pm-context',
  description: 'Fetch session data and project settings for PM review',
  inputSchema: summarizeOutputSchema,
  outputSchema: preparedPMContextSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { sessionId, projectId, tags, tagsApplied, reasoning, productScopeId, messages: pipelineMessages } = inputData
    logger?.info('[prepare-pm-context] Starting', { sessionId, projectId })
    await writer?.write({ type: 'progress', message: 'Fetching session context...' })

    // Fetch session data and project settings in parallel
    const [sessionRows, settingsRows] = await Promise.all([
      db
        .select({
          id: sessions.id,
          user_metadata: sessions.user_metadata,
          page_url: sessions.page_url,
          page_title: sessions.page_title,
          message_count: sessions.message_count,
          status: sessions.status,
        })
        .from(sessions)
        .where(eq(sessions.id, sessionId)),
      db
        .select({
          issue_tracking_enabled: projectSettings.issue_tracking_enabled,
          pm_dedup_include_closed: projectSettings.pm_dedup_include_closed,
        })
        .from(projectSettings)
        .where(eq(projectSettings.project_id, projectId)),
    ])

    const session = sessionRows[0]
    if (!session) {
      throw new Error(`Failed to fetch session: Not found`)
    }

    const settings = settingsRows[0]

    // Fetch product scope context if available
    let productScopeContext: {
      name: string
      description: string
      matchedGoalId: string | null
      matchedGoalText: string | null
      reasoning: string | null
    } | null = null

    if (productScopeId) {
      try {
        const [scopeRow, relRow] = await Promise.all([
          db
            .select({ name: productScopes.name, description: productScopes.description })
            .from(productScopes)
            .where(eq(productScopes.id, productScopeId))
            .then((rows) => rows[0] ?? null),
          db
            .select({ metadata: entityRelationships.metadata })
            .from(entityRelationships)
            .where(
              and(
                eq(entityRelationships.session_id, sessionId),
                eq(entityRelationships.product_scope_id, productScopeId),
                isNotNull(entityRelationships.product_scope_id),
              ),
            )
            .then((rows) => rows[0] ?? null),
        ])

        if (scopeRow) {
          const meta = (relRow?.metadata ?? {}) as Record<string, unknown>
          productScopeContext = {
            name: scopeRow.name,
            description: scopeRow.description ?? '',
            matchedGoalId: (meta.matchedGoalId as string) ?? null,
            matchedGoalText: (meta.matchedGoalText as string) ?? null,
            reasoning: (meta.reasoning as string) ?? null,
          }
        }
      } catch {
        // Non-fatal - proceed without scope context
      }
    }

    await writer?.write({
      type: 'progress',
      message: `Loaded ${pipelineMessages.length} messages`,
    })

    logger?.info('[prepare-pm-context] Completed', {
      messageCount: pipelineMessages.length,
      hasSettings: !!settings,
    })

    return {
      sessionId,
      projectId,
      tags,
      tagsApplied,
      reasoning,
      productScopeId,
      productScopeContext,
      session: {
        id: session.id,
        userId: (session.user_metadata as Record<string, string> | null)?.userId || null,
        userMetadata: session.user_metadata as Record<string, string> | null,
        pageUrl: session.page_url,
        pageTitle: session.page_title,
        messageCount: session.message_count ?? 0,
        status: session.status ?? 'active',
      },
      messages: pipelineMessages,
      settings: {
        issueTrackingEnabled: settings?.issue_tracking_enabled ?? true,
        pmDedupIncludeClosed: settings?.pm_dedup_include_closed ?? false,
      },
    }
  },
})
