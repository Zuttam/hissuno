import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured, createAdminClient } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { SlackClient } from '@/lib/integrations/slack/client'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/slack/channels/leave
 * Leave a channel and remove from configured channels
 * Body: { projectId, channelDbId }
 */
export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.slack.channels.leave] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { projectId, channelDbId } = body as { projectId?: string; channelDbId?: string }

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    if (!channelDbId) {
      return NextResponse.json({ error: 'channelDbId is required' }, { status: 400 })
    }

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new UnauthorizedError('User not authenticated')
    }

    // Verify user owns this project and get channel info
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: channel, error: channelError } = await (supabase as any)
      .from('slack_channels')
      .select(`
        id,
        channel_id,
        slack_workspace_tokens!inner(
          id,
          project_id,
          bot_token,
          projects!inner(user_id)
        )
      `)
      .eq('id', channelDbId)
      .single()

    if (channelError || !channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tokens = channel.slack_workspace_tokens as any
    const projectOwnerId = tokens?.projects?.user_id

    if (projectOwnerId !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Verify the channel belongs to the specified project
    if (tokens.project_id !== projectId) {
      return NextResponse.json({ error: 'Channel does not belong to this project' }, { status: 403 })
    }

    // Leave the channel in Slack
    const slackClient = new SlackClient(tokens.bot_token)
    const leaveResult = await slackClient.leaveChannel(channel.channel_id)

    // Even if leaving fails (e.g., already left), we still remove from DB
    if (!leaveResult.ok && leaveResult.error !== 'not_in_channel') {
      console.warn('[integrations.slack.channels.leave] Leave warning:', leaveResult.error)
    }

    // Delete the channel record from DB (soft delete by marking inactive)
    const adminSupabase = createAdminClient()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (adminSupabase as any)
      .from('slack_channels')
      .update({ is_active: false })
      .eq('id', channelDbId)

    if (deleteError) {
      console.error('[integrations.slack.channels.leave] DB update error:', deleteError)
      return NextResponse.json({ error: 'Failed to update channel record' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }

    console.error('[integrations.slack.channels.leave] unexpected error', error)
    return NextResponse.json({ error: 'Failed to leave channel.' }, { status: 500 })
  }
}
