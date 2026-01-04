import { NextResponse } from 'next/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, createAdminClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { createSSEStreamWithExecutor, createSSEEvent, type BaseSSEEvent } from '@/lib/sse'
import { mastra } from '@/mastra'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

const LOG_PREFIX = '[generate-spec.stream]'

/**
 * SSE event types for spec generation
 */
type SpecSSEEventType =
  | 'connected'
  | 'workflow-start'  // Initial workflow info with totalSteps
  | 'step-start'
  | 'step-progress'
  | 'step-finish'
  | 'text-chunk'      // Streaming text delta
  | 'tool-start'      // Tool invocation started
  | 'tool-finish'     // Tool invocation completed
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
 * Helper to get issue's project_id for authorization
 */
async function getIssueProjectId(issueId: string, supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: issue, error } = await supabase
    .from('issues')
    .select('project_id')
    .eq('id', issueId)
    .single()

  if (error || !issue) {
    return null
  }

  return issue.project_id
}

/**
 * GET /api/issues/[id]/generate-spec/stream
 * Server-Sent Events endpoint for real-time spec generation progress
 * Requires runId query parameter to identify the specific spec run
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: issueId } = await context.params
  const url = new URL(_request.url)
  const runId = url.searchParams.get('runId')

  // Validate runId is provided
  if (!runId) {
    return NextResponse.json({ error: 'runId query parameter is required.' }, { status: 400 })
  }

  if (!isSupabaseConfigured()) {
    console.error(`${LOG_PREFIX} Supabase must be configured`)
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    // Get project_id from issue for authorization
    const projectId = await getIssueProjectId(issueId, supabase)
    if (!projectId) {
      return NextResponse.json({ error: 'Issue not found.' }, { status: 404 })
    }

    await assertUserOwnsProject(supabase, user.id, projectId)

    // Fetch the specific spec run by runId (exact match, not "latest")
    const { data: specRun, error: specRunError } = await supabase
      .from('issue_spec_runs')
      .select('*')
      .eq('issue_id', issueId)
      .eq('run_id', runId)
      .eq('status', 'running')
      .single()

    if (specRunError && specRunError.code !== 'PGRST116') {
      console.error(`${LOG_PREFIX} failed to load spec run`, issueId, runId, specRunError)
      return NextResponse.json({ error: 'Failed to load spec run.' }, { status: 500 })
    }

    if (!specRun) {
      return NextResponse.json({ error: 'Spec run not found or not running.' }, { status: 404 })
    }

    // Get Spec Writer agent
    const specWriterAgent = mastra.getAgent('specWriterAgent')
    if (!specWriterAgent) {
      console.error(`${LOG_PREFIX} Spec Writer agent not found`)
      return NextResponse.json({ error: 'Spec Writer agent not found.' }, { status: 500 })
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

        // Send workflow-start with step information
        emitEvent('workflow-start', {
          message: 'Starting spec generation',
          data: {
            runId,
            totalSteps: 1,
          },
        })

        try {
          if (isClosed()) {
            close()
            return
          }

          // Create runtime context for the agent
          const { RuntimeContext } = await import('@mastra/core/runtime-context')
          const runtimeContext = new RuntimeContext()
          runtimeContext.set('projectId', projectId)

          // Single step: Generate and save spec
          emitEvent('step-start', {
            stepId: 'generate-spec',
            stepName: 'Generating specification',
            message: 'Gathering context and generating specification...',
          })

          // Simplified prompt - agent knows its process
          const prompt = `Generate a product specification for issue ${issueId}. Follow your process to gather context, research, write the spec, and save it.`

          // Use agent.stream() with AI SDK format for fullStream events
          const stream = await specWriterAgent.stream(prompt, {
            runtimeContext,
          })

          // Stream text chunks and tool events in real-time
          for await (const part of stream.fullStream) {
            if (isClosed()) break

            // Handle different event types from fullStream
            const partType = (part as { type?: string }).type

            switch (partType) {
              case 'text-delta':
                emitEvent('text-chunk', {
                  data: { content: (part as { textDelta?: string }).textDelta },
                })
                break
              case 'tool-call':
                emitEvent('tool-start', {
                  data: {
                    toolName: (part as { toolName?: string }).toolName,
                    args: (part as { args?: unknown }).args,
                  },
                })
                break
              case 'tool-result':
                emitEvent('tool-finish', {
                  data: {
                    toolName: (part as { toolName?: string }).toolName,
                    result: (part as { result?: unknown }).result,
                  },
                })
                break
            }
          }

          if (isClosed()) {
            close()
            return
          }

          // Wait for stream to complete
          await stream.text

          // Use admin client to check if spec was saved and update run status
          const adminSupabase = createAdminClient()

          // Get the updated issue to confirm spec exists
          const { data: updatedIssue } = await adminSupabase
            .from('issues')
            .select('product_spec, product_spec_generated_at')
            .eq('id', issueId)
            .single()

          if (updatedIssue?.product_spec) {
            emitEvent('step-finish', {
              stepId: 'generate-spec',
              stepName: 'Generating specification',
              message: 'Specification generated and saved',
            })

            // Update spec run as completed
            await adminSupabase
              .from('issue_spec_runs')
              .update({
                status: 'completed',
                completed_at: new Date().toISOString(),
              })
              .eq('id', specRun.id)

            emitEvent('workflow-finish', {
              message: 'Spec generation completed successfully',
              data: {
                specGeneratedAt: updatedIssue.product_spec_generated_at,
              },
            })
          } else {
            throw new Error('Spec was not saved to database')
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
              .eq('id', specRun.id)
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
