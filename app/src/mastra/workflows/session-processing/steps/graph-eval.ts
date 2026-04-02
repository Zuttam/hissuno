/**
 * Step: Graph Evaluation (Session Processing)
 *
 * Runs graph evaluation for the session with creation policies enabled.
 * Discovers product scopes and related entities, resolves contacts,
 * and creates/links issues based on PM decision logic.
 */

import { createStep } from '@mastra/core/workflows'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { sessions } from '@/lib/db/schema/app'
import { getGraphEvaluationSettingsAdmin } from '@/lib/db/queries/graph-evaluation-settings'
import { evaluateEntityRelationships } from '../../graph-evaluation'
import type { CreationContext } from '../../graph-evaluation/schemas'
import { summarizeOutputSchema, graphEvalOutputSchema } from '../schemas'

export const graphEvalSession = createStep({
  id: 'graph-eval-session',
  description: 'Discover relationships and run creation policies for the session',
  inputSchema: summarizeOutputSchema,
  outputSchema: graphEvalOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    if (!inputData) throw new Error('Input data not found')

    const { sessionId, projectId, tags, messages } = inputData
    const logger = mastra?.getLogger()

    logger?.info('[graph-eval-session] Starting', { sessionId, projectId })
    await writer?.write({ type: 'progress', message: 'Discovering relationships...' })

    // Fetch session user_metadata and graph eval settings in parallel
    const [sessionRow, graphSettings] = await Promise.all([
      db.query.sessions.findFirst({
        where: eq(sessions.id, sessionId),
        columns: { user_metadata: true },
      }),
      getGraphEvaluationSettingsAdmin(projectId),
    ])

    const userMetadata = (sessionRow?.user_metadata as Record<string, string> | null) ?? null

    // Only build creation context if creation policy is enabled
    let creationContext: CreationContext | undefined
    if (graphSettings.creation_policy_enabled) {
      creationContext = {
        tags,
        messages,
        userMetadata,
      }
    }

    const result = await evaluateEntityRelationships(projectId, 'session', sessionId, creationContext)

    if (result.errors.length > 0) {
      logger?.warn('[graph-eval-session] Errors during evaluation', { errors: result.errors })
    }

    const createdCount = result.createdIssueIds?.length ?? 0
    const linkedCount = result.pmAction === 'linked' ? 1 : 0

    logger?.info('[graph-eval-session] Completed', {
      relationshipsCreated: result.relationshipsCreated,
      productScopeId: result.productScopeId,
      pmAction: result.pmAction,
      createdIssueIds: result.createdIssueIds,
      createdContactId: result.createdContactId,
    })

    await writer?.write({
      type: 'progress',
      message: `Found ${result.relationshipsCreated} relationships${result.productScopeId ? ' + product scope' : ''}${createdCount > 0 ? ` + created ${createdCount} issue(s)` : ''}${linkedCount > 0 ? ' + linked issue' : ''}`,
    })

    return {
      ...inputData,
      productScopeId: result.productScopeId,
      pmAction: result.pmAction ?? 'skipped',
      createdIssueIds: result.createdIssueIds ?? [],
      createdContactId: result.createdContactId ?? null,
      pmSkipReason: result.pmSkipReason ?? null,
    }
  },
})
