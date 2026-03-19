import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { getSlackBotTokenByProject } from '@/lib/integrations/slack'
import { SlackClient } from '@/lib/integrations/slack/client'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/slack/channels/available?projectId=xxx
 * List public channels the bot can join (not already a member)
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.slack.channels.available] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const identity = await requireUserIdentity()

    await assertProjectAccess(identity, projectId)

    // Get Slack token for this project
    const tokenData = await getSlackBotTokenByProject(projectId)
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
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.slack.channels.available] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch available channels.' }, { status: 500 })
  }
}
