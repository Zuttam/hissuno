import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import {
  getSupportAgentSettings,
  updateSupportAgentSettings,
} from '@/lib/supabase/project-settings/support-agent'

export const runtime = 'nodejs'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

/**
 * GET /api/projects/[id]/settings/support-agent
 * Get support agent settings for a project
 */
export async function GET(_request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[settings.support-agent.get] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const settings = await getSupportAgentSettings(projectId)
    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[settings.support-agent.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load settings.' }, { status: 500 })
  }
}

/**
 * PATCH /api/projects/[id]/settings/support-agent
 * Update support agent settings for a project
 *
 * Body:
 * - support_agent_package_id?: string | null - ID of the package to use, or null to unset
 */
export async function PATCH(request: Request, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    console.error('[settings.support-agent.patch] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { support_agent_package_id } = body as {
      support_agent_package_id?: string | null
    }

    // Validate input - must explicitly provide the field
    if (support_agent_package_id === undefined) {
      return NextResponse.json(
        { error: 'support_agent_package_id is required.' },
        { status: 400 }
      )
    }

    const settings = await updateSupportAgentSettings(projectId, {
      support_agent_package_id,
    })

    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    if (error instanceof Error && error.message.includes('Invalid package ID')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('[settings.support-agent.patch] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update settings.' }, { status: 500 })
  }
}
