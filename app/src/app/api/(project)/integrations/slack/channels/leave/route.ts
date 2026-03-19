import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { slackChannels, slackWorkspaceTokens } from '@/lib/db/schema/app'
import { eq } from 'drizzle-orm'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { SlackClient } from '@/lib/integrations/slack/client'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/slack/channels/leave
 * Leave a channel and remove from configured channels
 * Body: { projectId, channelDbId }
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.slack.channels.leave] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
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

    const identity = await requireUserIdentity()

    // Verify user has access to this project and get channel info
    const channelRows = await db
      .select({
        id: slackChannels.id,
        channel_id: slackChannels.channel_id,
        project_id: slackWorkspaceTokens.project_id,
        bot_token: slackWorkspaceTokens.bot_token,
      })
      .from(slackChannels)
      .innerJoin(
        slackWorkspaceTokens,
        eq(slackChannels.workspace_token_id, slackWorkspaceTokens.id)
      )
      .where(eq(slackChannels.id, channelDbId))

    const channel = channelRows[0]

    if (!channel) {
      return NextResponse.json({ error: 'Channel not found' }, { status: 404 })
    }

    await assertProjectAccess(identity, channel.project_id)

    // Verify the channel belongs to the specified project
    if (channel.project_id !== projectId) {
      return NextResponse.json({ error: 'Channel does not belong to this project' }, { status: 403 })
    }

    // Leave the channel in Slack
    const slackClient = new SlackClient(channel.bot_token)
    const leaveResult = await slackClient.leaveChannel(channel.channel_id)

    // Even if leaving fails (e.g., already left), we still remove from DB
    if (!leaveResult.ok && leaveResult.error !== 'not_in_channel') {
      console.warn('[integrations.slack.channels.leave] Leave warning:', leaveResult.error)
    }

    // Soft delete by marking inactive
    await db
      .update(slackChannels)
      .set({ is_active: false })
      .where(eq(slackChannels.id, channelDbId))

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.slack.channels.leave] unexpected error', error)
    return NextResponse.json({ error: 'Failed to leave channel.' }, { status: 500 })
  }
}
