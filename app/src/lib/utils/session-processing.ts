import { getPmAgentSettingsAdmin } from '@/lib/db/queries/project-settings'
import { ensureSessionName } from '@/lib/sessions/name-generator'

/**
 * Fire-and-forget: trigger session processing workflow for a closed session.
 * Non-blocking, never throws. Used by the service layer when sessions are
 * created as closed (integrations) or transition to closed (widget lifecycle).
 *
 * The cron job in session-lifecycle acts as a safety net for any missed sessions.
 */
export function fireSessionProcessing(sessionId: string, projectId: string) {
  void (async () => {
    try {
      // Ensure session has a name before processing
      await ensureSessionName({ sessionId, projectId })

      const { mastra } = await import('@/mastra')
      const workflow = mastra.getWorkflow('sessionProcessingWorkflow')
      if (!workflow) return

      const pmSettings = await getPmAgentSettingsAdmin(projectId)

      const runId = `processing-${sessionId}-${Date.now()}`
      const run = await workflow.createRunAsync({ runId })
      const result = await run.start({
        inputData: {
          sessionId,
          projectId,
          classificationGuidelines: pmSettings.classification_guidelines ?? undefined,
        },
      })

      if (result.status === 'failed') {
        console.error(`[fireSessionProcessing] Workflow failed for session ${sessionId}:`, result.error?.message)
      }
    } catch (error) {
      console.error(`[fireSessionProcessing] Error for session ${sessionId}:`, error)
    }
  })()
}
