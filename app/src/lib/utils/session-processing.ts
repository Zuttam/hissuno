import { ensureSessionName } from '@/lib/sessions/name-generator'

/**
 * Fire-and-forget: trigger session processing for a closed session.
 * Non-blocking, never throws. Used by the service layer when sessions are
 * created as closed (integrations) or transition to closed (widget lifecycle).
 *
 * The cron job in session-lifecycle acts as a safety net for any missed sessions.
 */
export function fireSessionProcessing(sessionId: string, projectId: string) {
  void (async () => {
    try {
      await ensureSessionName({ sessionId, projectId })
      const { processSession } = await import('@/lib/sessions/sessions-service')
      await processSession(sessionId, projectId)
    } catch (error) {
      console.error(`[fireSessionProcessing] Error for session ${sessionId}:`, error)
    }
  })()
}
