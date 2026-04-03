import { NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import {
  sessions,
  sessionMessages,
  projectSettings,
} from '@/lib/db/schema/app'
import { eq, and, inArray, lte, isNull } from 'drizzle-orm'
import { updateSession } from '@/lib/db/queries/sessions'
import { fireSessionProcessing } from '@/lib/utils/session-processing'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOG_PREFIX = '[cron.session-lifecycle]'

// =========================================
// Types
// =========================================

interface PhaseResult {
  count: number
  errors: string[]
  closedIds?: Set<string>
}

// =========================================
// Phase functions
// =========================================

/**
 * Close sessions that are scheduled for close (closing_soon or awaiting_idle_response
 * with scheduled_close_at in the past). Does NOT trigger reviews.
 */
export async function closeScheduledSessions(now: Date): Promise<PhaseResult> {
  const result: PhaseResult = { count: 0, errors: [] }

  const sessionsToClose = await db
    .select({ id: sessions.id, project_id: sessions.project_id, status: sessions.status })
    .from(sessions)
    .where(
      and(
        inArray(sessions.status, ['closing_soon', 'awaiting_idle_response']),
        lte(sessions.scheduled_close_at, now)
      )
    )

  if (sessionsToClose.length === 0) {
    return result
  }

  console.log(`${LOG_PREFIX} Found ${sessionsToClose.length} sessions to close`)

  const closeResults = await Promise.allSettled(
    sessionsToClose.map((s) => updateSession(s.id, { status: 'closed' }))
  )

  const closedIds = new Set<string>()
  for (let i = 0; i < closeResults.length; i++) {
    const res = closeResults[i]
    if (res.status === 'fulfilled' && res.value) {
      result.count++
      closedIds.add(sessionsToClose[i].id)
    } else {
      const session = sessionsToClose[i]
      console.error(`${LOG_PREFIX} Error closing session ${session.id}:`, res.status === 'rejected' ? res.reason : 'Not found')
      result.errors.push(`Failed to close session ${session.id}`)
    }
  }

  result.closedIds = closedIds
  return result
}

/**
 * Send idle prompts to active sessions that have been inactive past their threshold.
 */
export async function sendIdlePrompts(now: Date): Promise<PhaseResult> {
  const result: PhaseResult = { count: 0, errors: [] }

  const activeSessions = await db
    .select({
      id: sessions.id,
      project_id: sessions.project_id,
      last_activity_at: sessions.last_activity_at,
      idle_prompt_sent_at: sessions.idle_prompt_sent_at,
    })
    .from(sessions)
    .where(
      and(
        eq(sessions.status, 'active'),
        isNull(sessions.idle_prompt_sent_at)
      )
    )

  if (activeSessions.length === 0) {
    return result
  }

  // Batch-fetch project settings
  const projectIds = [...new Set(activeSessions.map((s) => s.project_id))]

  const projectSettingsRows = await db
    .select({
      project_id: projectSettings.project_id,
      session_idle_timeout_minutes: projectSettings.session_idle_timeout_minutes,
      session_idle_response_timeout_seconds: projectSettings.session_idle_response_timeout_seconds,
    })
    .from(projectSettings)
    .where(inArray(projectSettings.project_id, projectIds))

  const settingsMap = new Map(
    projectSettingsRows.map((s) => [s.project_id, s])
  )

  const defaultIdleTimeout = 5 // minutes
  const defaultResponseTimeout = 60 // seconds

  for (const session of activeSessions) {
    const settings = settingsMap.get(session.project_id)
    const idleTimeoutMinutes = settings?.session_idle_timeout_minutes ?? defaultIdleTimeout
    const responseTimeoutSeconds = settings?.session_idle_response_timeout_seconds ?? defaultResponseTimeout

    const lastActivity = new Date(session.last_activity_at!)
    const idleThreshold = new Date(now.getTime() - idleTimeoutMinutes * 60 * 1000)

    if (lastActivity < idleThreshold) {
      try {
        console.log(`${LOG_PREFIX} Session ${session.id} is idle, sending prompt`)

        const scheduledCloseAt = new Date(now.getTime() + responseTimeoutSeconds * 1000)

        const messageId = crypto.randomUUID()
        await db
          .insert(sessionMessages)
          .values({
            id: messageId,
            session_id: session.id,
            project_id: session.project_id,
            sender_type: 'system',
            content: "Are you still there? Let me know if you need anything else, or I'll close this session shortly.",
            created_at: now,
          })

        await db
          .update(sessions)
          .set({
            status: 'awaiting_idle_response',
            idle_prompt_sent_at: now,
            scheduled_close_at: scheduledCloseAt,
          })
          .where(eq(sessions.id, session.id))

        result.count++
      } catch (err) {
        console.error(`${LOG_PREFIX} Error sending idle prompt to session ${session.id}:`, err)
        result.errors.push(`Failed to send idle prompt to session ${session.id}`)
      }
    }
  }

  return result
}

/**
 * Phase 3: Safety net - find closed sessions that haven't been base-processed.
 * Primary processing fires from the service layer when sessions close.
 * This catches any that were missed.
 *
 * `excludeIds` should contain session IDs already closed (and thus processed)
 * in Phase 1, to avoid double-firing the processing workflow.
 */
export async function triggerPendingProcessing(excludeIds?: Set<string>): Promise<PhaseResult> {
  const result: PhaseResult = { count: 0, errors: [] }

  const unprocessedSessions = await db
    .select({ id: sessions.id, project_id: sessions.project_id })
    .from(sessions)
    .where(
      and(
        eq(sessions.status, 'closed'),
        isNull(sessions.base_processed_at),
      )
    )
    .orderBy(sessions.updated_at)
    .limit(10)

  if (unprocessedSessions.length === 0) {
    return result
  }

  console.log(`${LOG_PREFIX} Found ${unprocessedSessions.length} unprocessed closed sessions (safety net)`)

  for (const session of unprocessedSessions) {
    if (excludeIds?.has(session.id)) continue
    fireSessionProcessing(session.id, session.project_id)
    result.count++
  }

  return result
}

// =========================================
// Route handler
// =========================================

/**
 * GET /api/cron/session-lifecycle
 * Cron job to handle session lifecycle:
 * 1. Auto-close sessions that are scheduled for close
 * 2. Send idle prompts to sessions that have been inactive
 * 3. Trigger base processing for closed sessions that were missed
 *
 * Should be run every minute via Vercel cron.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
  }

  if (!isDatabaseConfigured()) {
    console.error(`${LOG_PREFIX} Database must be configured`)
    return NextResponse.json({ error: 'Database must be configured' }, { status: 500 })
  }

  const now = new Date()

  try {
    // Phase 1 & 2 run in parallel (independent queries/statuses)
    const [closeResult, idleResult] = await Promise.all([
      closeScheduledSessions(now),
      sendIdlePrompts(now),
    ])

    // Phase 3: Base processing for unprocessed sessions (excludes Phase 1 IDs to avoid double-fire)
    const processResult = await triggerPendingProcessing(closeResult.closedIds)

    const results = {
      sessionsClosed: closeResult.count,
      idlePromptsSent: idleResult.count,
      sessionsProcessed: processResult.count,
      errors: [...closeResult.errors, ...idleResult.errors, ...processResult.errors],
    }

    console.log(`${LOG_PREFIX} Completed:`, results)

    return NextResponse.json({
      success: true,
      ...results,
    })
  } catch (error) {
    console.error(`${LOG_PREFIX} Unexpected error:`, error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown' },
      { status: 500 }
    )
  }
}
