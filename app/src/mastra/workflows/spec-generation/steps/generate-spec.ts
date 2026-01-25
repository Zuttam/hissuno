/**
 * Step: Generate Spec
 *
 * Uses the Spec Writer agent to generate a product specification
 * based on the prepared context. The agent has access to codebase
 * tools for research and the save-product-spec tool to persist.
 */

import { createStep } from '@mastra/core/workflows'
import { preparedContextSchema, generateSpecOutputSchema } from '../schemas'

export const generateSpec = createStep({
  id: 'generate-spec',
  description: 'Generate product specification using the Spec Writer agent',
  inputSchema: preparedContextSchema,
  outputSchema: generateSpecOutputSchema,
  execute: async ({ inputData, mastra, writer }) => {
    const logger = mastra?.getLogger()

    if (!inputData) {
      throw new Error('Input data not found')
    }

    const {
      issueId,
      projectId,
      issue,
      linkedSessions,
      knowledgeContext,
      localCodePath,
      codebaseLeaseId,
      codebaseCommitSha,
    } = inputData

    logger?.info('[generate-spec] Starting', { issueId, projectId })
    await writer?.write({ type: 'progress', message: 'Starting spec generation...' })

    // Get the Spec Writer agent
    const specWriterAgent = mastra?.getAgent('specWriterAgent')
    if (!specWriterAgent) {
      logger?.error('[generate-spec] Spec Writer agent not found')
      return {
        ...inputData,
        spec: null,
        specSaved: false,
        error: 'Spec Writer agent not configured',
      }
    }

    // Build context from linked sessions
    const sessionContext = linkedSessions
      .map((session, idx) => {
        const messages = session.userMessages.join('\n  - ')
        return `Session ${idx + 1}:\n  - ${messages}`
      })
      .join('\n\n')

    // Build the prompt with all context
    const prompt = `Generate a product specification for issue ${issueId}.

## Issue Details
- **Type**: ${issue.type}
- **Title**: ${issue.title}
- **Description**: ${issue.description}
- **Priority**: ${issue.priority}
- **Upvotes**: ${issue.upvoteCount}

## Customer Feedback
The following are user messages from sessions that reported this issue:

${sessionContext || 'No linked sessions available.'}

## Knowledge Context
${knowledgeContext || 'No knowledge context available.'}

## Codebase
${localCodePath ? `Available at: ${localCodePath}` : 'Codebase not available.'}

---

Follow your process to:
1. Research the codebase if available to understand the current implementation
2. Gather any additional context needed
3. Write a comprehensive product specification
4. Save the specification using the save-product-spec tool

The spec should be structured as a proper product specification document with:
- Overview and Problem Statement
- Proposed Solution
- Technical Requirements
- Acceptance Criteria
- Implementation Considerations`

    try {
      // Create runtime context for the agent
      const { RuntimeContext } = await import('@mastra/core/runtime-context')
      const runtimeContext = new RuntimeContext()
      runtimeContext.set('projectId', projectId)

      await writer?.write({ type: 'progress', message: 'Researching codebase...' })

      // Generate with the agent - it will use tools to save
      const response = await specWriterAgent.generate(prompt, {
        runtimeContext,
        maxSteps: 15, // Allow multiple tool iterations
        onStepFinish: async ({ text, toolCalls, finishReason }) => {
          logger?.debug('[generate-spec] Agent step', {
            hasText: !!text,
            toolCallCount: toolCalls?.length ?? 0,
            finishReason,
          })
          if (toolCalls && toolCalls.length > 0) {
            await writer?.write({
              type: 'progress',
              message: `Agent using ${toolCalls.length} tool(s)...`,
            })
          }
        },
      })

      const specContent = response.text || null

      // Verify the spec was saved by checking the issue record
      const { createAdminClient } = await import('@/lib/supabase/server')
      const supabase = createAdminClient()

      const { data: updatedIssue } = await supabase
        .from('issues')
        .select('product_spec, product_spec_generated_at')
        .eq('id', issueId)
        .single()

      const specSaved = !!updatedIssue?.product_spec

      if (specSaved) {
        await writer?.write({ type: 'progress', message: 'Specification saved successfully' })
        logger?.info('[generate-spec] Completed successfully', { issueId })
      } else {
        logger?.warn('[generate-spec] Spec not saved to database')
      }

      return {
        ...inputData,
        spec: specContent,
        specSaved,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      logger?.error('[generate-spec] Error', { error: message })

      await writer?.write({ type: 'progress', message: `Spec generation failed: ${message}` })

      return {
        ...inputData,
        spec: null,
        specSaved: false,
        error: message,
      }
    }
  },
})
