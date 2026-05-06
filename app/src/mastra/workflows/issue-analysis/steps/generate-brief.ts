/**
 * Step: Generate Brief
 *
 * Uses the Brief Writer agent to generate a product brief based on the
 * issue context gathered earlier in the workflow. The agent uses semantic
 * search to find relevant knowledge (not knowledge packages).
 */

import { createStep } from '@mastra/core/workflows'
import { db } from '@/lib/db'
import { eq, inArray } from 'drizzle-orm'
import { issues, sessions, productScopes, entityRelationships } from '@/lib/db/schema/app'
import { workflowOutputSchema } from '../schemas'

/**
 * Input is the compute-scores output (workflowOutputSchema) plus the
 * original context fields we need for brief generation.
 * Since compute-scores returns workflowOutputSchema and passes through
 * the cleanup step, we read from the same shape but also need access
 * to the issue context. We'll fetch what we need from the DB.
 */
const generateBriefInputSchema = workflowOutputSchema

const generateBriefOutputSchema = workflowOutputSchema

export const generateBrief = createStep({
  id: 'generate-brief',
  description: 'Generate product brief using the Brief Writer agent',
  inputSchema: generateBriefInputSchema,
  outputSchema: generateBriefOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    const { issueId, projectId } = inputData
    logger?.info('[generate-brief] Starting', { issueId, projectId })
    await writer?.write({ type: 'progress', message: 'Starting brief generation...' })

    // Get the Brief Writer agent
    const briefWriterAgent = mastra?.getAgent('briefWriterAgent')
    if (!briefWriterAgent) {
      logger?.error('[generate-brief] Brief Writer agent not found')
      return {
        ...inputData,
        briefGenerated: false,
      }
    }

    try {
      // Fetch issue
      const [issue] = await db
        .select({
          id: issues.id,
          name: issues.name,
          description: issues.description,
          type: issues.type,
          priority: issues.priority,
          status: issues.status,
        })
        .from(issues)
        .where(eq(issues.id, issueId))

      if (!issue) {
        logger?.warn('[generate-brief] Issue not found, skipping brief generation')
        return { ...inputData, briefGenerated: false }
      }

      // Get product scope and linked sessions from entity_relationships in a single query
      const erRows = await db
        .select({
          session_id: entityRelationships.session_id,
          product_scope_id: entityRelationships.product_scope_id,
        })
        .from(entityRelationships)
        .where(eq(entityRelationships.issue_id, issueId))

      let productScopeName: string | null = null
      let productScopeType: string | null = null
      let productScopeGoals: Array<{ id: string; text: string }> = []
      const psId = erRows.find((r) => r.product_scope_id)?.product_scope_id
      if (psId) {
        const [ps] = await db
          .select({ name: productScopes.name, type: productScopes.type, goals: productScopes.goals })
          .from(productScopes)
          .where(eq(productScopes.id, psId))
        productScopeName = ps?.name ?? null
        productScopeType = ps?.type ?? null
        productScopeGoals = Array.isArray(ps?.goals) ? (ps.goals as Array<{ id: string; text: string }>) : []
      }

      const sessionIds = [...new Set(erRows.map((r) => r.session_id).filter((id): id is string => id !== null))].slice(0, 5)

      // Get session page_urls in a single query
      const linkedSessions = sessionIds.length > 0
        ? await db
            .select({ id: sessions.id, page_url: sessions.page_url })
            .from(sessions)
            .where(inArray(sessions.id, sessionIds))
        : []

      // Get user messages from linked sessions
      const { getSessionMessages } = await import('@/lib/db/queries/session-messages')
      const sessionContext: string[] = []

      const allSessionMessages = await Promise.all(
        linkedSessions.map(async (sessionData) => ({
          pageUrl: sessionData.page_url,
          messages: await getSessionMessages(sessionData.id),
        }))
      )
      for (const { pageUrl, messages } of allSessionMessages) {
        const userMessages = messages
          .filter((m) => m.role === 'user')
          .slice(0, 10)
          .map((m) => m.content)

        if (userMessages.length > 0) {
          sessionContext.push(
            `Session (${pageUrl ?? 'unknown page'}):\n  - ${userMessages.join('\n  - ')}`
          )
        }
      }

      // Get briefGuidelines from the workflow trigger context
      const { getPmAgentSettingsAdmin } = await import('@/lib/db/queries/project-settings/workflow-guidelines')
      const pmSettings = await getPmAgentSettingsAdmin(projectId)
      const briefGuidelines = pmSettings.brief_guidelines ?? undefined

      // Build the prompt
      const prompt = `Generate a product brief for the following issue.

## Issue Details
- **Type**: ${issue.type}
- **Name**: ${issue.name}
- **Description**: ${issue.description}
- **Priority**: ${issue.priority}
- **Status**: ${issue.status}
- **Linked sessions**: ${sessionIds.length}
${productScopeName ? `- **Product Scope**: ${productScopeName}${productScopeType ? ` (${productScopeType})` : ''}` : ''}
${productScopeGoals.length > 0 ? `- **Goals**: ${productScopeGoals.map((g) => g.text).join('; ')}` : ''}

## Customer Feedback
${sessionContext.length > 0 ? sessionContext.join('\n\n') : 'No linked feedback available.'}

---
${briefGuidelines ? `\n## Brief Guidelines\n\n${briefGuidelines}\n` : ''}
Use the \`semantic-search-knowledge\` tool to find relevant product knowledge about this issue.
You can also use \`list-knowledge-items\` to see available knowledge sources and \`get-knowledge-content\` to load specific sources.
Search for terms related to the issue title, type, and product scope.

Then use \`web-search\` to research best practices and competitor approaches.

Finally, write a comprehensive brief and save it using the \`save-brief\` tool with issueId "${issueId}".`

      // Create request context for the agent
      const { RequestContext } = await import('@mastra/core/request-context')
      const requestContext = new RequestContext()
      requestContext.set('projectId', projectId)

      await writer?.write({ type: 'progress', message: 'Generating brief...' })

      const response = await briefWriterAgent.generate(prompt, {
        requestContext,
        maxSteps: 15,
        onStepFinish: async ({ toolCalls }) => {
          if (toolCalls && toolCalls.length > 0) {
            await writer?.write({
              type: 'progress',
              message: `Agent using ${toolCalls.length} tool(s)...`,
            })
          }
        },
      })

      logger?.debug('[generate-brief] Agent response length', { length: response.text?.length ?? 0 })

      // Verify the brief was saved
      const [updatedIssue] = await db
        .select({ brief: issues.brief })
        .from(issues)
        .where(eq(issues.id, issueId))

      const briefSaved = !!updatedIssue?.brief

      if (briefSaved) {
        await writer?.write({ type: 'progress', message: 'Brief saved successfully' })
        logger?.info('[generate-brief] Completed successfully', { issueId })
      } else {
        logger?.warn('[generate-brief] Brief not saved to database')
        await writer?.write({ type: 'progress', message: 'Brief generation completed but save could not be verified' })
      }

      return {
        ...inputData,
        briefGenerated: briefSaved,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger?.error('[generate-brief] Error', { error: message })
      await writer?.write({ type: 'progress', message: `Brief generation failed: ${message}` })

      return {
        ...inputData,
        briefGenerated: false,
      }
    }
  },
})
