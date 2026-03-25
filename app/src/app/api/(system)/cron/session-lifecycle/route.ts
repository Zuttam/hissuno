import { NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { isUniqueViolation } from '@/lib/db/errors'
import {
  sessions,
  sessionMessages,
  sessionReviews,
  projectSettings,
} from '@/lib/db/schema/app'
import { eq, and, inArray, lte, isNull, sql } from 'drizzle-orm'
import { ensureSessionName } from '@/lib/sessions/name-generator'
import { mastra } from '@/mastra'
import type { WorkflowOutput } from '@/mastra/workflows/session-review/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOG_PREFIX = '[cron.session-lifecycle]'

const REVIEW_BATCH_LIMIT = 10
const STALE_REVIEW_MINUTES = 15

// =========================================
// Types
// =========================================

interface PhaseResult {
  count: number
  errors: string[]
}

interface SessionToReview {
  id: string
  project_id: string
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

  try {
    const ids = sessionsToClose.map((s) => s.id)
    await db
      .update(sessions)
      .set({ status: 'closed', updated_at: now })
      .where(inArray(sessions.id, ids))
    result.count = ids.length
  } catch (err) {
    console.error(`${LOG_PREFIX} Error batch-closing sessions:`, err)
    result.errors.push(`Failed to batch-close ${sessionsToClose.length} sessions`)
  }

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
 * Execute a single session review: ensure name, insert record, run workflow.
 */
export async function executeSessionReview(
  session: SessionToReview
): Promise<{ triggered: boolean; error?: string }> {
  // Ensure session has a name before PM review
  await ensureSessionName({
    sessionId: session.id,
    projectId: session.project_id,
  })

  // Insert review record
  const runId = `pm-review-${session.id}-${Date.now()}`

  let reviewRecord: { id: string } | undefined
  try {
    const [record] = await db
      .insert(sessionReviews)
      .values({
        session_id: session.id,
        project_id: session.project_id,
        run_id: runId,
        status: 'running',
        metadata: {
          triggeredBy: 'session-lifecycle-cron',
          sessionId: session.id,
          projectId: session.project_id,
        },
      })
      .returning({ id: sessionReviews.id })
    reviewRecord = record
  } catch (pmError: unknown) {
    if (isUniqueViolation(pmError)) {
      // Unique constraint violation - review already exists
      return { triggered: false }
    }
    console.error(`${LOG_PREFIX} Failed to create review record for session ${session.id}:`, pmError)
    return { triggered: false, error: pmError instanceof Error ? pmError.message : String(pmError) }
  }

  if (!reviewRecord) {
    return { triggered: false, error: 'No review record returned' }
  }

  // Execute workflow
  const workflow = mastra.getWorkflow('sessionReviewWorkflow')
  if (!workflow) {
    console.warn(`${LOG_PREFIX} Session review workflow not configured, skipping review for session ${session.id}`)
    await db
      .update(sessionReviews)
      .set({
        status: 'skipped',
        completed_at: new Date(),
        result: { action: 'skipped', skipReason: 'Workflow not configured' },
      })
      .where(eq(sessionReviews.id, reviewRecord.id))
    return { triggered: true }
  }

  try {
    console.log(`${LOG_PREFIX} Executing session review workflow for session ${session.id}`)
    const run = await workflow.createRunAsync({ runId })
    const workflowResult = await run.start({
      inputData: {
        sessionId: session.id,
        projectId: session.project_id,
      },
    })

    if (workflowResult.status === 'failed') {
      throw new Error(workflowResult.error?.message ?? 'Workflow failed')
    }

    const steps = workflowResult.steps as Record<string, { output?: unknown } | undefined> | undefined
    const pmReviewOutput = steps?.['execute-decision']?.output as Partial<WorkflowOutput> | undefined
    const classifyOutput = steps?.['classify-session']?.output as { tags?: string[]; tagsApplied?: boolean } | undefined

    const resultData: WorkflowOutput = {
      tags: (classifyOutput?.tags ?? []) as WorkflowOutput['tags'],
      tagsApplied: classifyOutput?.tagsApplied ?? false,
      productScopeId: (classifyOutput as { productScopeId?: string | null } | undefined)?.productScopeId ?? null,
      action: pmReviewOutput?.action ?? 'skipped',
      issueId: pmReviewOutput?.issueId,
      issueTitle: pmReviewOutput?.issueTitle,
      skipReason: pmReviewOutput?.skipReason ?? (pmReviewOutput?.action ? undefined : 'No result from workflow'),
    }

    await db
      .update(sessionReviews)
      .set({
        status: 'completed',
        completed_at: new Date(),
        result: resultData,
      })
      .where(eq(sessionReviews.id, reviewRecord.id))

    console.log(`${LOG_PREFIX} Session review completed for session ${session.id}:`, resultData.action)
    return { triggered: true }
  } catch (workflowError) {
    console.error(`${LOG_PREFIX} Workflow execution failed for session ${session.id}:`, workflowError)
    await db
      .update(sessionReviews)
      .set({
        status: 'failed',
        completed_at: new Date(),
        error_message: workflowError instanceof Error ? workflowError.message : 'Unknown error',
      })
      .where(eq(sessionReviews.id, reviewRecord.id))
    return { triggered: false, error: workflowError instanceof Error ? workflowError.message : 'Unknown error' }
  }
}

/**
 * Find all closed sessions that need review and trigger reviews for them.
 * Cleans up stale running records first, then processes up to REVIEW_BATCH_LIMIT sessions.
 */
export async function triggerPendingReviews(): Promise<PhaseResult> {
  const result: PhaseResult = { count: 0, errors: [] }

  // Clean up stale running records (older than 15 min) -> mark as failed
  const staleThreshold = new Date(Date.now() - STALE_REVIEW_MINUTES * 60 * 1000)
  const staleRecords = await db
    .update(sessionReviews)
    .set({
      status: 'failed',
      completed_at: new Date(),
      error_message: 'Stale review record - timed out after 15 minutes',
    })
    .where(
      and(
        eq(sessionReviews.status, 'running'),
        lte(sessionReviews.created_at, staleThreshold)
      )
    )
    .returning({ id: sessionReviews.id })

  if (staleRecords.length > 0) {
    console.log(`${LOG_PREFIX} Cleaned up ${staleRecords.length} stale review records`)
  }

  // Find closed sessions with no terminal review record using a raw SQL approach
  // equivalent to the Supabase LEFT JOIN anti-pattern
  const unreviewedSessions = await db.execute(sql`
    SELECT s.id, s.project_id
    FROM sessions s
    LEFT JOIN session_reviews sr
      ON sr.session_id = s.id
      AND sr.status IN ('completed', 'running', 'skipped')
    WHERE s.status = 'closed'
      AND sr.id IS NULL
    ORDER BY s.updated_at ASC
    LIMIT ${REVIEW_BATCH_LIMIT}
  `) as unknown as { rows: Array<{ id: string; project_id: string }> }

  if (!unreviewedSessions.rows || unreviewedSessions.rows.length === 0) {
    return result
  }

  console.log(`${LOG_PREFIX} Found ${unreviewedSessions.rows.length} unreviewed closed sessions`)

  // Run session reviews in parallel
  const reviewResults = await Promise.allSettled(
    unreviewedSessions.rows.map((session) => executeSessionReview(session))
  )

  for (let i = 0; i < reviewResults.length; i++) {
    const res = reviewResults[i]
    const session = unreviewedSessions.rows[i]
    if (res.status === 'fulfilled') {
      if (res.value.triggered) {
        result.count++
      } else if (res.value.error) {
        result.errors.push(`Review failed for session ${session.id}: ${res.value.error}`)
      }
    } else {
      console.error(`${LOG_PREFIX} Error reviewing session ${session.id}:`, res.reason)
      result.errors.push(`Failed to review session ${session.id}`)
    }
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
 * 3. Trigger PM review for all closed sessions without a review
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

    // Phase 3 runs after close (needs newly-closed sessions)
    const reviewResult = await triggerPendingReviews()

    const results = {
      sessionsClosed: closeResult.count,
      idlePromptsSent: idleResult.count,
      pmReviewsTriggered: reviewResult.count,
      errors: [...closeResult.errors, ...idleResult.errors, ...reviewResult.errors],
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
