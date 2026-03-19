import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { slackWorkspaceTokens } from '@/lib/db/schema/app'
import { eq } from 'drizzle-orm'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { getSlackBotTokenByProject, getOrCreateSlackChannel } from '@/lib/integrations/slack'
import { SlackClient } from '@/lib/integrations/slack/client'

export const runtime = 'nodejs'

/**
 * POST /api/integrations/slack/channels/join
 * Join a public channel programmatically
 * Body: { projectId, channelId }
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.slack.channels.join] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
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

    const identity = await requireUserIdentity()

    await assertProjectAccess(identity, projectId)

    // Get Slack token for this project
    const tokenData = await getSlackBotTokenByProject(projectId)
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
    const workspaceTokenRows = await db
      .select({
        id: slackWorkspaceTokens.id,
        workspace_domain: slackWorkspaceTokens.workspace_domain,
      })
      .from(slackWorkspaceTokens)
      .where(eq(slackWorkspaceTokens.project_id, projectId))

    const workspaceToken = workspaceTokenRows[0]

    if (!workspaceToken) {
      return NextResponse.json({ error: 'Workspace token not found' }, { status: 500 })
    }

    // Create channel record in DB
    const channelType = channelInfo.is_private ? 'private_channel' : 'channel'
    const channelRecord = await getOrCreateSlackChannel({
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
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.slack.channels.join] unexpected error', error)
    return NextResponse.json({ error: 'Failed to join channel.' }, { status: 500 })
  }
}
