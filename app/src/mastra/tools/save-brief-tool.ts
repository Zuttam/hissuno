/**
 * Save Brief Tool
 *
 * Persists a generated brief to an issue record. Used by the Brief Writer Agent
 * as part of the issue analysis workflow.
 */

import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { issues } from '@/lib/db/schema/app'

export const saveBriefTool = createTool({
  id: 'save-brief',
  description: `Save a generated brief to an issue.
Call this after generating the brief content.`,
  inputSchema: z.object({
    issueId: z.string().describe('The issue ID to save the brief to'),
    brief: z.string().describe('The generated brief (markdown)'),
  }),
  outputSchema: z.object({
    success: z.boolean(),
    error: z.string().optional(),
  }),
  execute: async ({ context }) => {
    const { issueId, brief } = context

    try {
      await db
        .update(issues)
        .set({
          brief,
          brief_generated_at: new Date(),
          status: 'ready', // Auto-transition to ready when brief is generated
          updated_at: new Date(),
        })
        .where(eq(issues.id, issueId))

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
