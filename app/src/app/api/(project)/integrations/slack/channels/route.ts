import { NextRequest, NextResponse } from 'next/server'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { slackChannels, slackWorkspaceTokens } from '@/lib/db/schema/app'
import { eq, and, desc } from 'drizzle-orm'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { updateSlackChannelMode, type ChannelMode, type CaptureScope } from '@/lib/integrations/slack'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/slack/channels?projectId=xxx
 * List active Slack channels for a project
 */
export async function GET(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.slack.channels] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = request.nextUrl.searchParams.get('projectId')
    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 })
    }

    const identity = await requireUserIdentity()

    await assertProjectAccess(identity, projectId)

    // Get channels for this project via workspace token join
    const channels = await db
      .select({
        id: slackChannels.id,
        channel_id: slackChannels.channel_id,
        channel_name: slackChannels.channel_name,
        channel_type: slackChannels.channel_type,
        is_active: slackChannels.is_active,
        channel_mode: slackChannels.channel_mode,
        capture_scope: slackChannels.capture_scope,
        joined_at: slackChannels.joined_at,
      })
      .from(slackChannels)
      .innerJoin(
        slackWorkspaceTokens,
        eq(slackChannels.workspace_token_id, slackWorkspaceTokens.id)
      )
      .where(
        and(
          eq(slackWorkspaceTokens.project_id, projectId),
          eq(slackChannels.is_active, true)
        )
      )
      .orderBy(desc(slackChannels.joined_at))

    // Format response
    const formattedChannels = channels.map((ch) => ({
      id: ch.id,
      channelId: ch.channel_id,
      channelName: ch.channel_name,
      channelType: ch.channel_type,
      isActive: ch.is_active,
      channelMode: ch.channel_mode || 'interactive',
      captureScope: ch.capture_scope || 'external_only',
      joinedAt: ch.joined_at,
    }))

    return NextResponse.json({ channels: formattedChannels })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.slack.channels] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch channels.' }, { status: 500 })
  }
}

/**
 * PATCH /api/integrations/slack/channels
 * Update channel mode and capture scope
 * Body: { channelDbId, mode, captureScope? } for single channel
 * Body: { projectId, mode, captureScope?, applyToAll: true } for bulk update
 */
export async function PATCH(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    console.error('[integrations.slack.channels] Database must be configured')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const body = await request.json()
    const { channelDbId, projectId, mode, captureScope, applyToAll } = body as {
      channelDbId?: string
      projectId?: string
      mode?: string
      captureScope?: string
      applyToAll?: boolean
    }

    if (!mode) {
      return NextResponse.json({ error: 'mode is required' }, { status: 400 })
    }

    // Validate mode
    if (mode !== 'interactive' && mode !== 'passive') {
      return NextResponse.json(
        { error: 'mode must be "interactive" or "passive"' },
        { status: 400 }
      )
    }

    // Validate captureScope if provided
    if (captureScope && captureScope !== 'external_only' && captureScope !== 'all') {
      return NextResponse.json(
        { error: 'captureScope must be "external_only" or "all"' },
        { status: 400 }
      )
    }

    const identity = await requireUserIdentity()

    // Bulk update: apply to all channels for a project
    if (applyToAll) {
      if (!projectId) {
        return NextResponse.json({ error: 'projectId is required for bulk update' }, { status: 400 })
      }

      await assertProjectAccess(identity, projectId)

      // Get workspace token for this project
      const workspaceTokenRows = await db
        .select({ id: slackWorkspaceTokens.id })
        .from(slackWorkspaceTokens)
        .where(eq(slackWorkspaceTokens.project_id, projectId))

      const workspaceToken = workspaceTokenRows[0]

      if (!workspaceToken) {
        return NextResponse.json({ error: 'Slack not connected' }, { status: 400 })
      }

      // Update all active channels for this workspace
      const updateData: Record<string, unknown> = { channel_mode: mode }
      if (captureScope !== undefined) {
        updateData.capture_scope = captureScope
      }

      const updated = await db
        .update(slackChannels)
        .set(updateData)
        .where(
          and(
            eq(slackChannels.workspace_token_id, workspaceToken.id),
            eq(slackChannels.is_active, true)
          )
        )
        .returning({ id: slackChannels.id })

      return NextResponse.json({
        success: true,
        mode,
        captureScope: captureScope || 'external_only',
        updatedCount: updated.length,
      })
    }

    // Single channel update
    if (!channelDbId) {
      return NextResponse.json({ error: 'channelDbId is required' }, { status: 400 })
    }

    // Verify user has access to the project for this channel
    const channelRows = await db
      .select({
        id: slackChannels.id,
        project_id: slackWorkspaceTokens.project_id,
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

    // Update channel mode
    const result = await updateSlackChannelMode(
      channelDbId,
      mode as ChannelMode,
      captureScope as CaptureScope | undefined
    )

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      mode,
      captureScope: captureScope || 'external_only',
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: error.message }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[integrations.slack.channels] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update channel mode.' }, { status: 500 })
  }
}
