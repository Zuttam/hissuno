import { NextRequest, NextResponse } from 'next/server'
import { isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError, getClientForIdentity } from '@/lib/auth/authorization'
import { hasSlackIntegration, disconnectSlack } from '@/lib/integrations/slack'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/slack?projectId=xxx
 * Check if project has Slack integration connected
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.slack.get] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const identity = await requireUserIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await getClientForIdentity(identity)
    const status = await hasSlackIntegration(supabase, projectId)

    return NextResponse.json(status)
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.slack.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to check integration status.' }, { status: 500 })
  }
}

/**
 * DELETE /api/integrations/slack?projectId=xxx
 * Disconnect Slack integration from project
 */
export async function DELETE(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.slack.delete] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const identity = await requireUserIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await getClientForIdentity(identity)
    const result = await disconnectSlack(supabase, projectId)

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.slack.delete] unexpected error', error)
    return NextResponse.json({ error: 'Failed to disconnect Slack.' }, { status: 500 })
  }
}
