/**
 * Step: Prepare Context
 *
 * Gathers all context needed for issue analysis:
 * - Issue details (type, title, description, upvote count)
 * - Linked sessions with customer/company data
 * - Session timestamps for velocity computation
 * - Relevant knowledge from knowledge packages
 */

import { createStep } from '@mastra/core/workflows'
import { createAdminClient } from '@/lib/supabase/server'
import { getIssueForAnalysisAdmin, getIssueSessionTimestamps } from '@/lib/supabase/issues'
import { workflowContextWithCodebaseSchema, preparedContextSchema } from '../schemas'

export const prepareContext = createStep({
  id: 'prepare-context',
  description: 'Gather issue context, linked feedback sessions, and knowledge for analysis',
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

    // Get session timestamps for velocity computation
    const supabase = createAdminClient()
    const timestamps = await getIssueSessionTimestamps(supabase, issueId)

    // Map sessions to flat structure
    const sessions = issue.sessions.map((s) => ({
      id: s.id,
      createdAt: s.createdAt,
      contactId: s.contactId,
      companyId: s.contact?.company?.id ?? null,
      companyArr: s.contact?.company?.arr ?? null,
      companyStage: s.contact?.company?.stage ?? null,
    }))

    // Fetch knowledge context
    await writer?.write({ type: 'progress', message: 'Loading knowledge context...' })
    let knowledgeContext = ''
    const { data: packages } = await supabase
      .from('knowledge_packages')
      .select('category, storage_path')
      .eq('project_id', projectId)

    if (packages && packages.length > 0) {
      const relevantCategories = ['product', 'technical']
      for (const pkg of packages) {
        if (relevantCategories.includes(pkg.category)) {
          try {
            const { data: content } = await supabase.storage
              .from('knowledge-packages')
              .download(pkg.storage_path)

            if (content) {
              const text = await content.text()
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
      message: `Context prepared: ${sessions.length} sessions`,
    })

    logger?.info('[prepare-context] Completed', {
      sessionCount: sessions.length,
      timestampCount: timestamps.length,
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
        description: issue.description,
        upvoteCount: issue.upvoteCount,
        impactScore: issue.impactScore,
        effortEstimate: issue.effortEstimate,
        priorityManualOverride: issue.priorityManualOverride,
      },
      sessions,
      sessionTimestamps: timestamps.map((t) => t.toISOString()),
      knowledgeContext,
    }
  },
})
