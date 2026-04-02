/**
 * Step: Prepare Context
 *
 * Gathers all context needed for issue analysis:
 * - Issue details (type, title, description, upvote count)
 * - Linked sessions with customer/company data
 * - Session timestamps for reach computation
 */

import { createStep } from '@mastra/core/workflows'
import { and, eq, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { entityRelationships } from '@/lib/db/schema/app'
import { getIssueForAnalysisAdmin, getIssueSessionTimestamps } from '@/lib/db/queries/issues'
import { workflowContextWithCodebaseSchema, preparedContextSchema } from '../schemas'

export const prepareContext = createStep({
  id: 'prepare-context',
  description: 'Gather issue context and linked feedback sessions for analysis',
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

    // Fetch issue with sessions
    const issue = await getIssueForAnalysisAdmin(issueId)
    if (!issue) {
      throw new Error(`Issue not found: ${issueId}`)
    }

    // Get session timestamps for reach computation
    const timestamps = await getIssueSessionTimestamps(issueId)

    // Map sessions to flat structure
    const sessions = issue.sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      contactId: s.contactId,
      companyId: s.contact?.company?.id ?? null,
      companyArr: s.contact?.company?.arr ?? null,
      companyStage: s.contact?.company?.stage ?? null,
    }))

    // Look up product scope from entity relationships (assigned at issue creation)
    const scopeRows = await db
      .select({ product_scope_id: entityRelationships.product_scope_id })
      .from(entityRelationships)
      .where(
        and(
          eq(entityRelationships.issue_id, issueId),
          isNotNull(entityRelationships.product_scope_id),
        )
      )
      .limit(1)
    const productScopeId = scopeRows[0]?.product_scope_id ?? null

    await writer?.write({
      type: 'progress',
      message: `Context prepared: ${sessions.length} sessions${productScopeId ? ' + product scope' : ''}`,
    })

    logger?.info('[prepare-context] Completed', {
      sessionCount: sessions.length,
      timestampCount: timestamps.length,
      productScopeId,
    })

    return {
      issueId,
      projectId,
      runId: inputData.runId,
      analysisGuidelines: inputData.analysisGuidelines,
      briefGuidelines: inputData.briefGuidelines,
      localCodePath,
      codebaseLeaseId,
      codebaseCommitSha,
      issue: {
        id: issue.id,
        type: issue.type,
        name: issue.name,
        description: issue.description,
        sessionCount: issue.sessionCount,
        impactScore: issue.impactScore,
        effortEstimate: issue.effortEstimate,
        priorityManualOverride: issue.priorityManualOverride,
      },
      sessions,
      sessionTimestamps: timestamps.map((t) => t.toISOString()),
      productScopeId,
    }
  },
})
