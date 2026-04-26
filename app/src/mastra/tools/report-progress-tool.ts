/**
 * report-progress tool.
 *
 * Skill agents call this between phases so the user (and persistent record)
 * sees what's happening. Two side effects: appends a JSONB event to the
 * automation_runs row, and (when present) writes to the in-memory pubsub so
 * SSE listeners stream the event in real time.
 */

import { createTool } from '@mastra/core/tools'
import { z } from 'zod'
import { appendProgressEvent } from '@/lib/db/queries/automation-runs'
import { publishRunEvent } from '@/lib/automations/run-bus'

export const reportProgressTool = createTool({
  id: 'report_progress',
  description: `Report progress to the user. Call this between phases of your work
(e.g., "Gathering customer signals", "Writing health summary"). The user sees the
message in real time. Keep messages short - one short sentence each.`,
  inputSchema: z.object({
    message: z.string().describe('Short, user-facing progress message.'),
    phase: z.string().optional().describe('Optional phase label (e.g., "research", "synthesis").'),
  }),
  outputSchema: z.object({
    ok: z.boolean(),
  }),
  execute: async (input, { requestContext }) => {
    const runId = requestContext?.get?.('runId') as string | undefined
    if (!runId) {
      // No run context - silently noop. Useful when the agent is invoked
      // outside the automation harness (e.g., unit tests).
      return { ok: true }
    }

    const event = {
      ts: new Date().toISOString(),
      type: 'progress',
      message: input.message,
      data: input.phase ? { phase: input.phase } : undefined,
    }

    await appendProgressEvent(runId, event)
    publishRunEvent(runId, event)

    return { ok: true }
  },
})
