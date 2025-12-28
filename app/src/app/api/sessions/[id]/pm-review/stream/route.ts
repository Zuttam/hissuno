import { NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { createSSEStreamWithExecutor, createSSEEvent } from '@/lib/sse'
import { mastra } from '@/mastra'
import type { PMReviewResult, PMReviewSSEEvent } from '@/types/issue'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

const LOG_PREFIX = '[pm-review.stream]'

/**
 * GET /api/sessions/[id]/pm-review/stream
 * Server-Sent Events endpoint for real-time PM review progress
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: sessionId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error(`${LOG_PREFIX} Supabase must be configured`)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  const supabase = createAdminClient()

  // Fetch the running review for this session
  const { data: runningReview, error: reviewError } = await supabase
    .from('pm_reviews')
    .select('*')
    .eq('session_id', sessionId)
    .eq('status', 'running')
    .order('started_at', { ascending: false })
    .limit(1)
    .single()

  if (reviewError && reviewError.code !== 'PGRST116') {
    console.error(`${LOG_PREFIX} failed to load review`, sessionId, reviewError)
    return NextResponse.json({ error: 'Failed to load review.' }, { status: 500 })
  }

  if (!runningReview) {
    return NextResponse.json({ error: 'No running review found.' }, { status: 404 })
  }

  // Get session details for the review
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, project_id')
    .eq('id', sessionId)
    .single()

  if (sessionError || !session) {
    console.error(`${LOG_PREFIX} Session not found`, sessionId)
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
  }

  return createSSEStreamWithExecutor<PMReviewSSEEvent>({
    logPrefix: LOG_PREFIX,
    executor: async ({ emit, close }) => {
      // Helper to create typed events
      const emitEvent = (
        type: PMReviewSSEEvent['type'],
        options: Partial<Omit<PMReviewSSEEvent, 'type' | 'timestamp'>> = {}
      ) => {
        emit(createSSEEvent(type, options) as PMReviewSSEEvent)
      }

      // Send connected event
      emitEvent('connected', { message: 'Connected to PM review stream' })

      try {
        // Start review
        emitEvent('review-start', { message: 'Starting PM review analysis' })

        // Step 1: Get context
        emitEvent('step-start', {
          stepId: 'get-context',
          stepName: 'Fetching session context',
          message: 'Loading conversation messages...',
        })

        const pmAgent = mastra.getAgent('productManagerAgent')
        if (!pmAgent) {
          throw new Error('Product Manager agent not found')
        }

        // Create runtime context
        const { RuntimeContext } = await import('@mastra/core/runtime-context')
        const runtimeContext = new RuntimeContext()
        runtimeContext.set('projectId', session.project_id)

        emitEvent('step-finish', {
          stepId: 'get-context',
          stepName: 'Fetching session context',
          message: 'Session context loaded',
        })

        // Step 2: Analyze
        emitEvent('step-start', {
          stepId: 'analyze',
          stepName: 'Analyzing feedback',
          message: 'Determining if session contains actionable feedback...',
        })

        const prompt = `Analyze session ${sessionId} for actionable feedback.

1. First, use get-session-context to retrieve the conversation
2. Determine if the session contains actionable feedback (bug, feature request, or change request)
3. If actionable, check for similar issues using find-similar-issues
4. Either upvote an existing issue or create a new one
5. If upvoting and threshold is met, generate a product spec

Return your analysis results including:
- Whether an issue was created, upvoted, or skipped
- The issue ID and title if applicable
- If skipped, explain why
- If threshold was met, whether a spec was generated`

        const response = await pmAgent.generate(prompt, {
          runtimeContext,
        })

        emitEvent('step-finish', {
          stepId: 'analyze',
          stepName: 'Analyzing feedback',
          message: 'Analysis complete',
        })

        // Parse the response
        const text = typeof response.text === 'string' ? response.text : ''
        const textLower = text.toLowerCase()

        let action: 'created' | 'upvoted' | 'skipped' = 'skipped'
        let issueId: string | undefined
        let issueTitle: string | undefined
        let skipReason: string | undefined
        let thresholdMet = false
        let specGenerated = false

        if (textLower.includes('created') && textLower.includes('issue')) {
          action = 'created'
        } else if (textLower.includes('upvoted') || textLower.includes('upvote')) {
          action = 'upvoted'
        }

        if (textLower.includes('threshold') && (textLower.includes('met') || textLower.includes('reached'))) {
          thresholdMet = true
        }
        if (textLower.includes('spec') && (textLower.includes('generated') || textLower.includes('saved'))) {
          specGenerated = true
        }

        if (action === 'skipped') {
          if (textLower.includes('skip') || textLower.includes('not actionable')) {
            skipReason = 'Session does not contain actionable feedback'
          } else if (textLower.includes('q&a') || textLower.includes('resolved')) {
            skipReason = 'Session was a simple Q&A with resolution'
          } else if (textLower.includes('few messages') || textLower.includes('short')) {
            skipReason = 'Session has too few messages for analysis'
          } else {
            skipReason = 'No actionable feedback identified'
          }
        }

        const result: PMReviewResult = {
          action,
          issueId,
          issueTitle,
          skipReason,
          thresholdMet,
          specGenerated,
        }

        // Update the review record with result
        await supabase
          .from('pm_reviews')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
            result,
          })
          .eq('id', runningReview.id)

        // Update session's pm_reviewed_at
        await supabase
          .from('sessions')
          .update({ pm_reviewed_at: new Date().toISOString() })
          .eq('id', sessionId)

        // Send completion event with result
        emitEvent('review-finish', {
          message: 'PM review completed',
          result,
        })

        close()
      } catch (error) {
        console.error(`${LOG_PREFIX} Error:`, error)

        // Mark as failed
        await supabase
          .from('pm_reviews')
          .update({
            status: 'failed',
            completed_at: new Date().toISOString(),
            error_message: error instanceof Error ? error.message : 'Unknown error',
          })
          .eq('id', runningReview.id)

        emitEvent('error', {
          message: 'PM review failed. Please try again.',
        })

        close()
      }
    },
  })
}
