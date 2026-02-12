import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { verifyCronSecret } from '@/lib/auth/admin-api'
import { UnauthorizedError } from '@/lib/auth/server'
import { checkEnforcement } from '@/lib/billing/enforcement-service'
import { ensureSessionName } from '@/lib/sessions/name-generator'
import { mastra } from '@/mastra'
import type { WorkflowOutput } from '@/mastra/workflows/session-review/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOG_PREFIX = '[cron.session-lifecycle]'

const REVIEW_BATCH_LIMIT = 100
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

type AdminClient = ReturnType<typeof createAdminClient>

// =========================================
// Phase functions
// =========================================

/**
 * Close sessions that are scheduled for close (closing_soon or awaiting_idle_response
 * with scheduled_close_at in the past). Does NOT trigger reviews.
 */
export async function closeScheduledSessions(supabase: AdminClient, now: Date): Promise<PhaseResult> {
  const result: PhaseResult = { count: 0, errors: [] }

  const { data: sessionsToClose, error: closeError } = await supabase
    .from('sessions')
    .select('id, project_id, status')
    .in('status', ['closing_soon', 'awaiting_idle_response'])
    .lte('scheduled_close_at', now.toISOString())

  if (closeError) {
    console.error(`${LOG_PREFIX} Error fetching sessions to close:`, closeError)
    result.errors.push('Failed to fetch sessions to close')
    return result
  }

  if (!sessionsToClose || sessionsToClose.length === 0) {
    return result
  }

  console.log(`${LOG_PREFIX} Found ${sessionsToClose.length} sessions to close`)

  for (const session of sessionsToClose) {
    try {
      await supabase
        .from('sessions')
        .update({
          status: 'closed',
          updated_at: now.toISOString(),
        })
        .eq('id', session.id)

      result.count++
    } catch (err) {
      console.error(`${LOG_PREFIX} Error closing session ${session.id}:`, err)
      result.errors.push(`Failed to close session ${session.id}`)
    }
  }

  return result
}

/**
 * Send idle prompts to active sessions that have been inactive past their threshold.
 */
export async function sendIdlePrompts(supabase: AdminClient, now: Date): Promise<PhaseResult> {
  const result: PhaseResult = { count: 0, errors: [] }

  const { data: activeSessions, error: activeError } = await supabase
    .from('sessions')
    .select(`
      id,
      project_id,
      last_activity_at,
      idle_prompt_sent_at
    `)
    .eq('status', 'active')
    .is('idle_prompt_sent_at', null)

  if (activeError) {
    console.error(`${LOG_PREFIX} Error fetching active sessions:`, activeError)
    result.errors.push('Failed to fetch active sessions')
    return result
  }

  if (!activeSessions || activeSessions.length === 0) {
    return result
  }

  // Batch-fetch project settings
  const projectIds = [...new Set(activeSessions.map((s) => s.project_id))]

  const { data: projectSettings } = await supabase
    .from('project_settings')
    .select('project_id, session_idle_timeout_minutes, session_idle_response_timeout_seconds')
    .in('project_id', projectIds)

  const settingsMap = new Map(
    (projectSettings ?? []).map((s) => [s.project_id, s])
  )

  const defaultIdleTimeout = 5 // minutes
  const defaultResponseTimeout = 60 // seconds

  for (const session of activeSessions) {
    const settings = settingsMap.get(session.project_id)
    const idleTimeoutMinutes = settings?.session_idle_timeout_minutes ?? defaultIdleTimeout
    const responseTimeoutSeconds = settings?.session_idle_response_timeout_seconds ?? defaultResponseTimeout

    const lastActivity = new Date(session.last_activity_at)
    const idleThreshold = new Date(now.getTime() - idleTimeoutMinutes * 60 * 1000)

    if (lastActivity < idleThreshold) {
      try {
        console.log(`${LOG_PREFIX} Session ${session.id} is idle, sending prompt`)

        const scheduledCloseAt = new Date(now.getTime() + responseTimeoutSeconds * 1000).toISOString()

        const messageId = crypto.randomUUID()
        await supabase
          .from('session_messages')
          .insert({
            id: messageId,
            session_id: session.id,
            project_id: session.project_id,
            sender_type: 'system',
            content: "Are you still there? Let me know if you need anything else, or I'll close this session shortly.",
            created_at: now.toISOString(),
          })

        await supabase
          .from('sessions')
          .update({
            status: 'awaiting_idle_response',
            idle_prompt_sent_at: now.toISOString(),
            scheduled_close_at: scheduledCloseAt,
          })
          .eq('id', session.id)

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
 * Execute a single session review: ensure name, check billing, insert record, run workflow.
 */
export async function executeSessionReview(
  supabase: AdminClient,
  session: SessionToReview
): Promise<{ triggered: boolean; error?: string; limitReachedUserId?: string }> {
  // Ensure session has a name before PM review
  await ensureSessionName({
    sessionId: session.id,
    projectId: session.project_id,
  })

  // Check billing limit
  const { data: project } = await supabase
    .from('projects')
    .select('user_id')
    .eq('id', session.project_id)
    .single()

  if (project?.user_id) {
    const limitResult = await checkEnforcement({
      userId: project.user_id,
      dimension: 'analyzed_sessions',
      supabaseClient: supabase,
    })

    console.log(`${LOG_PREFIX} Enforcement check for user ${project.user_id}: allowed=${limitResult.allowed}, current=${limitResult.current}, limit=${limitResult.limit}, remaining=${limitResult.remaining}`)

    if (!limitResult.allowed) {
      console.log(`${LOG_PREFIX} Skipping PM review for session ${session.id} - analyzed sessions limit reached`)
      await markSessionLimitSkipped(supabase, session)
      return { triggered: false, error: 'limit_reached', limitReachedUserId: project.user_id }
    }
  }

  // Insert review record
  const runId = `pm-review-${session.id}-${Date.now()}`
  const { data: reviewRecord, error: pmError } = await supabase
    .from('session_reviews')
    .insert({
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
    .select()
    .single()

  if (pmError) {
    if (pmError.code === '23505') {
      // Unique constraint violation - review already exists
      return { triggered: false }
    }
    console.error(`${LOG_PREFIX} Failed to create review record for session ${session.id}:`, pmError)
    return { triggered: false, error: pmError.message }
  }

  if (!reviewRecord) {
    return { triggered: false, error: 'No review record returned' }
  }

  // Execute workflow
  const workflow = mastra.getWorkflow('sessionReviewWorkflow')
  if (!workflow) {
    console.warn(`${LOG_PREFIX} Session review workflow not configured, skipping review for session ${session.id}`)
    await supabase
      .from('session_reviews')
      .update({
        status: 'skipped',
        completed_at: new Date().toISOString(),
        result: { action: 'skipped', skipReason: 'Workflow not configured' },
      })
      .eq('id', reviewRecord.id)
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
    const pmReviewOutput = steps?.['pm-review']?.output as Partial<WorkflowOutput> | undefined
    const classifyOutput = steps?.['classify-session']?.output as { tags?: string[]; tagsApplied?: boolean } | undefined

    const resultData: WorkflowOutput = {
      tags: (classifyOutput?.tags ?? []) as WorkflowOutput['tags'],
      tagsApplied: classifyOutput?.tagsApplied ?? false,
      action: pmReviewOutput?.action ?? 'skipped',
      issueId: pmReviewOutput?.issueId,
      issueTitle: pmReviewOutput?.issueTitle,
      skipReason: pmReviewOutput?.skipReason ?? (pmReviewOutput?.action ? undefined : 'No result from workflow'),
    }

    await supabase
      .from('session_reviews')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        result: resultData,
      })
      .eq('id', reviewRecord.id)

    console.log(`${LOG_PREFIX} Session review completed for session ${session.id}:`, resultData.action)
    return { triggered: true }
  } catch (workflowError) {
    console.error(`${LOG_PREFIX} Workflow execution failed for session ${session.id}:`, workflowError)
    await supabase
      .from('session_reviews')
      .update({
        status: 'failed',
        completed_at: new Date().toISOString(),
        error_message: workflowError instanceof Error ? workflowError.message : 'Unknown error',
      })
      .eq('id', reviewRecord.id)
    return { triggered: false, error: workflowError instanceof Error ? workflowError.message : 'Unknown error' }
  }
}

/**
 * Insert a completed session_reviews record for a session skipped due to billing limit.
 * This removes the session from the "unreviewed" queue so it won't be re-fetched.
 */
async function markSessionLimitSkipped(supabase: AdminClient, session: SessionToReview): Promise<void> {
  await supabase.from('session_reviews').insert({
    session_id: session.id,
    project_id: session.project_id,
    run_id: `pm-review-${session.id}-limit-skip-${Date.now()}`,
    status: 'skipped',
    completed_at: new Date().toISOString(),
    result: { action: 'skipped', skipReason: 'Billing limit reached for analyzed sessions' },
    metadata: { triggeredBy: 'session-lifecycle-cron', skippedReason: 'limit_reached' },
  })
}

/**
 * Find all closed sessions that need review and trigger reviews for them.
 * Cleans up stale running records first, then processes up to REVIEW_BATCH_LIMIT sessions.
 */
export async function triggerPendingReviews(supabase: AdminClient): Promise<PhaseResult> {
  const result: PhaseResult = { count: 0, errors: [] }

  // Clean up stale running records (older than 15 min) → mark as failed
  const staleThreshold = new Date(Date.now() - STALE_REVIEW_MINUTES * 60 * 1000).toISOString()
  const { data: staleRecords } = await supabase
    .from('session_reviews')
    .update({
      status: 'failed',
      completed_at: new Date().toISOString(),
      error_message: 'Stale review record - timed out after 15 minutes',
    })
    .eq('status', 'running')
    .lte('created_at', staleThreshold)
    .select('id')

  if (staleRecords && staleRecords.length > 0) {
    console.log(`${LOG_PREFIX} Cleaned up ${staleRecords.length} stale review records`)
  }

  // Single query: closed sessions with no terminal review record (LEFT JOIN anti-pattern).
  // The .in() scopes which reviews to join, and .is() keeps only sessions where no match exists.
  // Sessions with only 'failed' reviews are included (eligible for retry).
  const { data: unreviewedSessions, error: fetchError } = await supabase
    .from('sessions')
    .select('id, project_id, session_reviews!left(id)')
    .eq('status', 'closed')
    .in('session_reviews.status', ['completed', 'running', 'skipped'])
    .is('session_reviews', null)
    .order('updated_at', { ascending: true })
    .limit(REVIEW_BATCH_LIMIT)

  if (fetchError) {
    console.error(`${LOG_PREFIX} Error fetching unreviewed sessions:`, fetchError)
    result.errors.push('Failed to fetch unreviewed sessions for review')
    return result
  }

  if (!unreviewedSessions || unreviewedSessions.length === 0) {
    return result
  }

  console.log(`${LOG_PREFIX} Found ${unreviewedSessions.length} unreviewed closed sessions`)

  // Pre-fetch project → user mappings to track rate-limited users across the batch
  const projectIds = [...new Set(unreviewedSessions.map((s) => s.project_id))]
  const { data: projects } = await supabase
    .from('projects')
    .select('id, user_id')
    .in('id', projectIds)

  const projectUserMap = new Map((projects ?? []).map((p) => [p.id, p.user_id]))
  const limitReachedUserIds = new Set<string>()

  for (const session of unreviewedSessions) {
    try {
      // Skip sessions for users already known to be rate-limited in this batch
      const userId = projectUserMap.get(session.project_id)
      if (userId && limitReachedUserIds.has(userId)) {
        console.log(`${LOG_PREFIX} Session ${session.id} skipped - user ${userId} already at limit in this batch`)
        await markSessionLimitSkipped(supabase, session)
        continue
      }

      const reviewResult = await executeSessionReview(supabase, session)
      if (reviewResult.triggered) {
        console.log(`${LOG_PREFIX} Session ${session.id} review triggered successfully`)
        result.count++
      } else if (reviewResult.limitReachedUserId) {
        console.log(`${LOG_PREFIX} Session ${session.id} skipped - user ${reviewResult.limitReachedUserId} hit limit (enforcement check)`)
        limitReachedUserIds.add(reviewResult.limitReachedUserId)
      } else if (reviewResult.error && reviewResult.error !== 'limit_reached') {
        result.errors.push(`Review failed for session ${session.id}: ${reviewResult.error}`)
      }
    } catch (err) {
      console.error(`${LOG_PREFIX} Error reviewing session ${session.id}:`, err)
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
export async function GET(request: NextRequest) {
  try {
    verifyCronSecret(request)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      console.error(`${LOG_PREFIX} Invalid cron secret`)
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    throw error
  }

  if (!isSupabaseConfigured()) {
    console.error(`${LOG_PREFIX} Supabase must be configured`)
    return NextResponse.json({ error: 'Supabase must be configured' }, { status: 500 })
  }

  const supabase = createAdminClient()
  const now = new Date()

  try {
    // Phase 1 & 2 run in parallel (independent queries/statuses)
    const [closeResult, idleResult] = await Promise.all([
      closeScheduledSessions(supabase, now),
      sendIdlePrompts(supabase, now),
    ])

    // Phase 3 runs after close (needs newly-closed sessions)
    const reviewResult = await triggerPendingReviews(supabase)

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
