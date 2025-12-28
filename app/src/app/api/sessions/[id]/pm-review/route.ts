import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { mastra } from '@/mastra'
import type { PMReviewResult } from '@/types/issue'

export const runtime = 'nodejs'

interface RouteParams {
  params: Promise<{ id: string }>
}

/**
 * POST /api/sessions/[id]/pm-review
 * Manually trigger PM agent analysis on a session.
 *
 * Response:
 * - success: boolean
 * - result: PMReviewResult - the analysis result
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  if (!isSupabaseConfigured()) {
    console.error('[sessions.pm-review] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { id: sessionId } = await params

    const supabase = createAdminClient()

    // Get session to verify it exists and get project ID
    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .select('id, project_id, pm_reviewed_at')
      .eq('id', sessionId)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
    }

    // Run PM review
    const result = await runPMReview(sessionId, session.project_id)

    return NextResponse.json({
      success: true,
      result,
    })
  } catch (error) {
    console.error('[sessions.pm-review] unexpected error', error)
    return NextResponse.json({ error: 'Unable to run PM review.' }, { status: 500 })
  }
}

/**
 * Run PM agent to analyze a session
 */
async function runPMReview(
  sessionId: string,
  projectId: string
): Promise<PMReviewResult> {
  const pmAgent = mastra.getAgent('productManagerAgent')

  if (!pmAgent) {
    throw new Error('Product Manager agent not found')
  }

  // Create a runtime context with projectId
  const { RuntimeContext } = await import('@mastra/core/runtime-context')
  const runtimeContext = new RuntimeContext()
  runtimeContext.set('projectId', projectId)

  // Ask the PM agent to analyze this session
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

  // Parse the response to extract the result
  const text = typeof response.text === 'string' ? response.text : ''
  const textLower = text.toLowerCase()

  // Determine the action from the response text
  let action: 'created' | 'upvoted' | 'skipped' = 'skipped'
  let issueId: string | undefined
  let issueTitle: string | undefined
  let skipReason: string | undefined
  let thresholdMet = false
  let specGenerated = false

  // Parse from response text
  if (textLower.includes('created') && textLower.includes('issue')) {
    action = 'created'
  } else if (textLower.includes('upvoted') || textLower.includes('upvote')) {
    action = 'upvoted'
  }

  // Check for threshold and spec generation
  if (textLower.includes('threshold') && (textLower.includes('met') || textLower.includes('reached'))) {
    thresholdMet = true
  }
  if (textLower.includes('spec') && (textLower.includes('generated') || textLower.includes('saved'))) {
    specGenerated = true
  }

  // Extract skip reason
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

  return {
    action,
    issueId,
    issueTitle,
    skipReason,
    thresholdMet,
    specGenerated,
  }
}
