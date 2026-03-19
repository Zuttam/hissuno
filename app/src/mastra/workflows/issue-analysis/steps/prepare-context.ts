/**
 * Step: Prepare Context
 *
 * Gathers all context needed for issue analysis:
 * - Issue details (type, title, description, upvote count)
 * - Linked sessions with customer/company data
 * - Session timestamps for reach computation
 */

import { createStep } from '@mastra/core/workflows'
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

    await writer?.write({
      type: 'progress',
      message: `Context prepared: ${sessions.length} sessions`,
    })

    logger?.info('[prepare-context] Completed', {
      sessionCount: sessions.length,
      timestampCount: timestamps.length,
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
        title: issue.title,
        description: issue.description,
        upvoteCount: issue.upvoteCount,
        impactScore: issue.impactScore,
        effortEstimate: issue.effortEstimate,
        priorityManualOverride: issue.priorityManualOverride,
      },
      sessions,
      sessionTimestamps: timestamps.map((t) => t.toISOString()),
    }
  },
})
