import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { checkEnforcement } from '@/lib/billing/enforcement-service'
import { mastra } from '@/mastra'
import type { WorkflowOutput } from '@/mastra/workflows/session-review/schemas'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const LOG_PREFIX = '[cron.session-lifecycle]'

/**
 * GET /api/cron/session-lifecycle
 * Cron job to handle session lifecycle:
 * 1. Send idle prompts to sessions that have been inactive
 * 2. Auto-close sessions that are scheduled for close
 * 3. Trigger PM review for closed sessions
 *
 * Should be run every minute via Vercel cron.
 */
export async function GET(request: NextRequest) {
  // Verify cron secret if configured
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      console.error(`${LOG_PREFIX} Invalid cron secret`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  }

  if (!isSupabaseConfigured()) {
    console.error(`${LOG_PREFIX} Supabase must be configured`)
    return NextResponse.json({ error: 'Supabase must be configured' }, { status: 500 })
  }

  const supabase = createAdminClient()
  const now = new Date()
  const results = {
    idlePromptsSent: 0,
    sessionsClosed: 0,
    pmReviewsTriggered: 0,
    errors: [] as string[],
  }

  try {
    // =========================================
    // 1. Auto-close sessions scheduled for close
    // =========================================
    const { data: sessionsToClose, error: closeError } = await supabase
      .from('sessions')
      .select('id, project_id, status')
      .in('status', ['closing_soon', 'awaiting_idle_response'])
      .lte('scheduled_close_at', now.toISOString())

    if (closeError) {
      console.error(`${LOG_PREFIX} Error fetching sessions to close:`, closeError)
      results.errors.push('Failed to fetch sessions to close')
    } else if (sessionsToClose && sessionsToClose.length > 0) {
      console.log(`${LOG_PREFIX} Found ${sessionsToClose.length} sessions to close`)

      for (const session of sessionsToClose) {
        try {
          // Close the session
          await supabase
            .from('sessions')
            .update({
              status: 'closed',
              updated_at: now.toISOString(),
            })
            .eq('id', session.id)

          results.sessionsClosed++

          // Check analyzed sessions limit before triggering PM review
          // Get project owner for limit check
          const { data: project } = await supabase
            .from('projects')
            .select('user_id')
            .eq('id', session.project_id)
            .single()

          if (project?.user_id) {
            const limitResult = await checkEnforcement({
              userId: project.user_id,
              dimension: 'analyzed_sessions',
            })

            if (!limitResult.allowed) {
              console.log(`${LOG_PREFIX} Skipping PM review for session ${session.id} - analyzed sessions limit reached`)
              continue
            }
          }

          // Trigger PM review - create record and execute workflow
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
            if (pmError.code !== '23505') {
              // Ignore unique constraint violations (review already in progress)
              console.error(`${LOG_PREFIX} Failed to trigger PM review for session ${session.id}:`, pmError)
            }
          } else if (reviewRecord) {
            // Execute the workflow directly
            const workflow = mastra.getWorkflow('sessionReviewWorkflow')
            if (workflow) {
              try {
                console.log(`${LOG_PREFIX} Executing session review workflow for session ${session.id}`)
                const run = await workflow.createRunAsync({ runId })
                const workflowResult = await run.start({
                  inputData: {
                    sessionId: session.id,
                    projectId: session.project_id,
                  },
                })

                // Check if workflow succeeded
                if (workflowResult.status === 'failed') {
                  throw new Error(workflowResult.error?.message ?? 'Workflow failed')
                }

                // Extract result from the pm-review step output
                // Mastra stores step outputs in workflowResult.steps['step-id']
                // Using type assertion since Mastra's types are complex
                const steps = workflowResult.steps as Record<string, { output?: unknown } | undefined> | undefined
                const pmReviewOutput = steps?.['pm-review']?.output as Partial<WorkflowOutput> | undefined
                const classifyOutput = steps?.['classify-session']?.output as { tags?: string[]; tagsApplied?: boolean } | undefined

                // Build combined result from step outputs
                const resultData: WorkflowOutput = {
                  tags: (classifyOutput?.tags ?? []) as WorkflowOutput['tags'],
                  tagsApplied: classifyOutput?.tagsApplied ?? false,
                  action: pmReviewOutput?.action ?? 'skipped',
                  issueId: pmReviewOutput?.issueId,
                  issueTitle: pmReviewOutput?.issueTitle,
                  skipReason: pmReviewOutput?.skipReason ?? (pmReviewOutput?.action ? undefined : 'No result from workflow'),
                  thresholdMet: pmReviewOutput?.thresholdMet,
                  specGenerated: pmReviewOutput?.specGenerated,
                }

                // Update the review record with the result
                await supabase
                  .from('session_reviews')
                  .update({
                    status: 'completed',
                    completed_at: new Date().toISOString(),
                    result: resultData,
                  })
                  .eq('id', reviewRecord.id)

                results.pmReviewsTriggered++
                console.log(`${LOG_PREFIX} Session review completed for session ${session.id}:`, resultData.action)
              } catch (workflowError) {
                console.error(`${LOG_PREFIX} Workflow execution failed for session ${session.id}:`, workflowError)
                // Mark review as failed
                await supabase
                  .from('session_reviews')
                  .update({
                    status: 'failed',
                    completed_at: new Date().toISOString(),
                    error_message: workflowError instanceof Error ? workflowError.message : 'Unknown error',
                  })
                  .eq('id', reviewRecord.id)
              }
            } else {
              console.warn(`${LOG_PREFIX} Session review workflow not configured, skipping review for session ${session.id}`)
              // Mark as completed with skip reason
              await supabase
                .from('session_reviews')
                .update({
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                  result: { action: 'skipped', skipReason: 'Workflow not configured' },
                })
                .eq('id', reviewRecord.id)
              results.pmReviewsTriggered++
            }
          }
        } catch (err) {
          console.error(`${LOG_PREFIX} Error closing session ${session.id}:`, err)
          results.errors.push(`Failed to close session ${session.id}`)
        }
      }
    }

    // =========================================
    // 2. Send idle prompts to inactive sessions
    // =========================================
    // Get all active sessions with their project settings
    const { data: activeSessions, error: activeError } = await supabase
      .from('sessions')
      .select(`
        id,
        project_id,
        last_activity_at,
        idle_prompt_sent_at
      `)
      .eq('status', 'active')
      .is('idle_prompt_sent_at', null) // Haven't sent idle prompt yet

    if (activeError) {
      console.error(`${LOG_PREFIX} Error fetching active sessions:`, activeError)
      results.errors.push('Failed to fetch active sessions')
    } else if (activeSessions && activeSessions.length > 0) {
      // Get unique project IDs
      const projectIds = [...new Set(activeSessions.map((s) => s.project_id))]

      // Fetch settings for all projects
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

            // Calculate when to auto-close if no response
            const scheduledCloseAt = new Date(now.getTime() + responseTimeoutSeconds * 1000).toISOString()

            // Insert system message asking if user is still there
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

            // Update session status
            await supabase
              .from('sessions')
              .update({
                status: 'awaiting_idle_response',
                idle_prompt_sent_at: now.toISOString(),
                scheduled_close_at: scheduledCloseAt,
              })
              .eq('id', session.id)

            results.idlePromptsSent++
          } catch (err) {
            console.error(`${LOG_PREFIX} Error sending idle prompt to session ${session.id}:`, err)
            results.errors.push(`Failed to send idle prompt to session ${session.id}`)
          }
        }
      }
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
