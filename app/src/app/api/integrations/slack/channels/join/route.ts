import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured, createAdminClient } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import { getSlackBotTokenByProject, getOrCreateSlackChannel } from '@/lib/integrations/slack'
import { SlackClient } from '@/lib/integrations/slack/client'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/slack/channels/join
 * Join a public channel programmatically
 * Body: { projectId, channelId }
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.slack.channels.join] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { projectId, channelId } = body as { projectId?: string; channelId?: string }

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    if (!channelId) {
      return NextResponse.json({ error: 'channelId is required' }, { status: 400 })
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

    const slackClient = new SlackClient(tokenData.token)

    // Join the channel in Slack
    const joinResult = await slackClient.joinChannel(channelId)
    if (!joinResult.ok) {
      return NextResponse.json({ error: joinResult.error || 'Failed to join channel' }, { status: 400 })
    }

    // Get channel info to store in DB
    const channelInfo = await slackClient.getChannelInfo(channelId)
    if (!channelInfo) {
      return NextResponse.json({ error: 'Failed to get channel info' }, { status: 500 })
    }

    // Get workspace token ID
    const adminSupabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: workspaceToken } = await (adminSupabase as any)
      .from('slack_workspace_tokens')
      .select('id, workspace_domain')
      .eq('project_id', projectId)
      .single()

    if (!workspaceToken) {
      return NextResponse.json({ error: 'Workspace token not found' }, { status: 500 })
    }

    // Create channel record in DB
    const channelType = channelInfo.is_private ? 'private_channel' : 'channel'
    const channelRecord = await getOrCreateSlackChannel(adminSupabase, {
      workspaceTokenId: workspaceToken.id,
      channelId: channelInfo.id,
      channelName: channelInfo.name,
      channelType,
      workspacePrimaryDomain: workspaceToken.workspace_domain,
    })

    if (!channelRecord) {
      return NextResponse.json({ error: 'Failed to create channel record' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      channel: {
        id: channelRecord.id,
        channelId: channelInfo.id,
        channelName: channelInfo.name,
        channelType,
      },
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('[integrations.slack.channels.join] unexpected error', error)
    return NextResponse.json({ error: 'Failed to join channel.' }, { status: 500 })
  }
}
