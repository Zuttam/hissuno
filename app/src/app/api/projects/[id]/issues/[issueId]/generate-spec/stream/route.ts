import { NextResponse } from 'next/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { createSSEStreamWithExecutor, createSSEEvent, type BaseSSEEvent } from '@/lib/sse'
import { mastra } from '@/mastra'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string; issueId: string }

type RouteContext = {
  params: Promise<RouteParams>
}

const LOG_PREFIX = '[generate-spec.stream]'

/**
 * SSE event types for spec generation
 */
type SpecSSEEventType =
  | 'connected'
  | 'step-start'
  | 'step-progress'
  | 'step-finish'
  | 'workflow-finish'
  | 'error'

interface SpecSSEEvent extends BaseSSEEvent {
  type: SpecSSEEventType
}

async function resolveUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new UnauthorizedError('User not authenticated')
  }

  return { supabase, user }
}

/**
 * GET /api/projects/[id]/issues/[issueId]/generate-spec/stream
 * Server-Sent Events endpoint for real-time spec generation progress
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId, issueId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error(`${LOG_PREFIX} Supabase must be configured`)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    await assertUserOwnsProject(supabase, user.id, projectId)

    // Fetch the latest running spec run
    const { data: latestSpecRun, error: specRunError } = await supabase
      .from('issue_spec_runs')
      .select('*')
      .eq('issue_id', issueId)
      .eq('status', 'running')
      .order('started_at', { ascending: false })
      .limit(1)
      .single()

    if (specRunError && specRunError.code !== 'PGRST116') {
      console.error(`${LOG_PREFIX} failed to load spec run`, issueId, specRunError)
      return NextResponse.json({ error: 'Failed to load spec run.' }, { status: 500 })
    }

    if (!latestSpecRun) {
      return NextResponse.json({ error: 'No running spec generation found.' }, { status: 404 })
    }

    // Get PM agent
    const pmAgent = mastra.getAgent('productManagerAgent')
    if (!pmAgent) {
      console.error(`${LOG_PREFIX} PM agent not found`)
      return NextResponse.json({ error: 'Product Manager agent not found.' }, { status: 500 })
    }

    return createSSEStreamWithExecutor<SpecSSEEvent>({
      logPrefix: LOG_PREFIX,
      executor: async ({ emit, close, isClosed }) => {
        // Helper to create typed events
        const emitEvent = (
          type: SpecSSEEventType,
          options: Partial<Omit<SpecSSEEvent, 'type' | 'timestamp'>> = {}
        ) => {
          emit(createSSEEvent(type, options) as SpecSSEEvent)
        }

        // Send initial connected event
        console.log(`${LOG_PREFIX} Sending connected event...`)
        emitEvent('connected', { message: 'Connected to spec generation stream' })

        try {
          // Step 1: Gathering context
          emitEvent('step-start', {
            stepId: 'gather-context',
            stepName: 'Gathering context',
            message: 'Starting: Gathering issue and session context',
          })

          if (isClosed()) {
            close()
            return
          }

          // Create runtime context for the agent
          const { RuntimeContext } = await import('@mastra/core/runtime-context')
          const runtimeContext = new RuntimeContext()
          runtimeContext.set('projectId', projectId)

          emitEvent('step-progress', {
            stepId: 'gather-context',
            message: 'Loading issue details and linked sessions...',
          })

          // Step 2: Generate spec using PM agent
          emitEvent('step-finish', {
            stepId: 'gather-context',
            stepName: 'Gathering context',
            message: 'Completed: Gathering context',
          })

          if (isClosed()) {
            close()
            return
          }

          emitEvent('step-start', {
            stepId: 'generate-spec',
            stepName: 'Generating specification',
            message: 'Starting: Generating product specification',
          })

          const prompt = `Generate a product specification for issue ${issueId}.

1. Use generate-product-spec to gather all context (issue details, linked sessions, project knowledge)
2. Based on the context, generate a comprehensive product specification following the spec template
3. Use save-product-spec to store the generated specification

The spec should be detailed enough for an engineer to understand the scope and requirements.`

          emitEvent('step-progress', {
            stepId: 'generate-spec',
            message: 'AI is analyzing context and generating specification...',
          })

          const response = await pmAgent.generate(prompt, {
            runtimeContext,
          })

          if (isClosed()) {
            close()
            return
          }

          emitEvent('step-finish', {
            stepId: 'generate-spec',
            stepName: 'Generating specification',
            message: 'Completed: Generating specification',
          })

          // Step 3: Verify spec was saved
          emitEvent('step-start', {
            stepId: 'save-spec',
            stepName: 'Saving specification',
            message: 'Starting: Saving specification',
          })

          // Check if spec was saved by looking at the response and database
          const responseText = typeof response.text === 'string' ? response.text.toLowerCase() : ''
          const specSaved = responseText.includes('spec') &&
            (responseText.includes('saved') || responseText.includes('generated') || responseText.includes('success'))

          // Use admin client to update spec run status
          const adminSupabase = createAdminClient()

          if (specSaved) {
            // Get the updated issue to confirm spec exists
            const { data: updatedIssue } = await adminSupabase
              .from('issues')
              .select('product_spec, product_spec_generated_at')
              .eq('id', issueId)
              .single()

            if (updatedIssue?.product_spec) {
              emitEvent('step-finish', {
                stepId: 'save-spec',
                stepName: 'Saving specification',
                message: 'Completed: Specification saved',
              })

              // Update spec run as completed
              await adminSupabase
                .from('issue_spec_runs')
                .update({
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                })
                .eq('id', latestSpecRun.id)

              emitEvent('workflow-finish', {
                message: 'Spec generation completed successfully',
                data: {
                  specGeneratedAt: updatedIssue.product_spec_generated_at,
                },
              })
            } else {
              throw new Error('Spec was not saved to database')
            }
          } else {
            throw new Error('Agent did not successfully generate specification')
          }

          close()
        } catch (error) {
          console.error(`${LOG_PREFIX} stream error`, error)

          // Mark the spec run as failed in the database
          try {
            const adminSupabase = createAdminClient()
            await adminSupabase
              .from('issue_spec_runs')
              .update({
                status: 'failed',
                completed_at: new Date().toISOString(),
                error_message: error instanceof Error ? error.message : 'Stream error',
              })
              .eq('id', latestSpecRun.id)
          } catch (dbError) {
            console.error(`${LOG_PREFIX} Failed to update spec run record:`, dbError)
          }

          // Send user-friendly error event
          emitEvent('error', {
            message: 'Spec generation encountered an issue. Please try again.',
          })

          close()
        }
      },
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error(`${LOG_PREFIX} unexpected error`, error)
    return NextResponse.json({ error: 'Failed to stream spec generation.' }, { status: 500 })
  }
}
