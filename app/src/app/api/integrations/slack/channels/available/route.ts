import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import { getSlackBotTokenByProject } from '@/lib/integrations/slack'
import { SlackClient } from '@/lib/integrations/slack/client'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/slack/channels/available?projectId=xxx
 * List public channels the bot can join (not already a member)
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.slack.channels.available] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new UnauthorizedError('User not authenticated')
    }

    // Verify user owns this project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, user_id')
      .eq('id', projectId)
      .single()

    if (projectError || !project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const hasAccess = await hasProjectAccess(projectId, user.id)
    if (!hasAccess) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Get Slack token for this project
    const tokenData = await getSlackBotTokenByProject(supabase, projectId)
    if (!tokenData) {
      return NextResponse.json({ error: 'Slack not connected' }, { status: 400 })
    }

    // List public channels
    const slackClient = new SlackClient(tokenData.token)
    const allChannels = await slackClient.listPublicChannels()

    // Filter to channels bot is NOT a member of
    const availableChannels = allChannels
      .filter((ch) => !ch.is_member && !ch.is_archived)
      .map((ch) => ({
        id: ch.id,
        name: ch.name,
        numMembers: ch.num_members,
        topic: ch.topic?.value || null,
        purpose: ch.purpose?.value || null,
      }))

    return NextResponse.json({ channels: availableChannels })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('[integrations.slack.channels.available] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch available channels.' }, { status: 500 })
  }
}
