import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import {
  getSupportAgentSettings,
  updateSupportAgentSettings,
} from '@/lib/db/queries/project-settings/support-agent'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'

export const runtime = 'nodejs'

/**
 * GET /api/settings/agents/support-agent?projectId=...
 * Get support agent settings for a project
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[settings.workflows.support-agent.get] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const settings = await getSupportAgentSettings(projectId)
    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[settings.workflows.support-agent.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to load settings.' }, { status: 500 })
  }
}

/**
 * PATCH /api/settings/agents/support-agent?projectId=...
 * Update support agent settings for a project
 *
 * Body:
 * - support_agent_package_id?: string | null - ID of the package to use, or null to unset
 */
export async function PATCH(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[settings.workflows.support-agent.patch] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const body = await request.json()
    const {
      support_agent_package_id,
      support_agent_tone,
      brand_guidelines,
      session_idle_timeout_minutes,
      session_goodbye_delay_seconds,
      session_idle_response_timeout_seconds,
      support_agent_memory_enabled,
    } = body as {
      support_agent_package_id?: string | null
      support_agent_tone?: string | null
      brand_guidelines?: string | null
      session_idle_timeout_minutes?: number
      session_goodbye_delay_seconds?: number
      session_idle_response_timeout_seconds?: number
      support_agent_memory_enabled?: boolean
    }

    // Build update object with only provided fields
    const updates: Record<string, string | number | boolean | null> = {}
    if (support_agent_package_id !== undefined) updates.support_agent_package_id = support_agent_package_id
    if (support_agent_tone !== undefined) updates.support_agent_tone = support_agent_tone
    if (brand_guidelines !== undefined) updates.brand_guidelines = brand_guidelines
    if (support_agent_memory_enabled !== undefined) {
      if (typeof support_agent_memory_enabled !== 'boolean') {
        return NextResponse.json({ error: 'support_agent_memory_enabled must be a boolean.' }, { status: 400 })
      }
      updates.support_agent_memory_enabled = support_agent_memory_enabled
    }

    // Session lifecycle fields with validation
    if (session_idle_timeout_minutes !== undefined) {
      if (session_idle_timeout_minutes < 1 || session_idle_timeout_minutes > 60) {
        return NextResponse.json({ error: 'Idle timeout must be between 1 and 60 minutes.' }, { status: 400 })
      }
      updates.session_idle_timeout_minutes = session_idle_timeout_minutes
    }
    if (session_goodbye_delay_seconds !== undefined) {
      if (session_goodbye_delay_seconds < 0 || session_goodbye_delay_seconds > 300) {
        return NextResponse.json({ error: 'Goodbye delay must be between 0 and 300 seconds.' }, { status: 400 })
      }
      updates.session_goodbye_delay_seconds = session_goodbye_delay_seconds
    }
    if (session_idle_response_timeout_seconds !== undefined) {
      if (session_idle_response_timeout_seconds < 10 || session_idle_response_timeout_seconds > 300) {
        return NextResponse.json({ error: 'Response timeout must be between 10 and 300 seconds.' }, { status: 400 })
      }
      updates.session_idle_response_timeout_seconds = session_idle_response_timeout_seconds
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No settings provided to update.' },
        { status: 400 }
      )
    }

    const settings = await updateSupportAgentSettings(projectId, updates)

    return NextResponse.json({ settings })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    if (error instanceof Error && error.message.includes('Invalid package ID')) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    console.error('[settings.workflows.support-agent.patch] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update settings.' }, { status: 500 })
  }
}
