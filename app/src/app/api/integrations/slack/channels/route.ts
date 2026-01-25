import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { updateSlackChannelMode, type ChannelMode, type CaptureScope } from '@/lib/integrations/slack'
import { createAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

/**
 * GET /api/integrations/slack/channels?projectId=xxx
 * List active Slack channels for a project
 */
export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    console.error('[integrations.slack.channels] Supabase must be configured')
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

    if (project.user_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
    }

    // Get channels for this project via workspace token
    // Using raw query since types aren't generated yet
    const { data: channels, error: channelsError } = await (supabase as any)
      .from('slack_channels')
      .select(`
        id,
        channel_id,
        channel_name,
        channel_type,
        is_active,
        channel_mode,
        capture_scope,
        joined_at,
        slack_workspace_tokens!inner(project_id)
      `)
      .eq('slack_workspace_tokens.project_id', projectId)
      .eq('is_active', true)
      .order('joined_at', { ascending: false })

    if (channelsError) {
      console.error('[integrations.slack.channels] Query error:', channelsError)
      return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 })
    }

    // Format response
    const formattedChannels = (channels || []).map((ch: any) => ({
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
  if (!isSupabaseConfigured()) {
    console.error('[integrations.slack.channels] Supabase must be configured')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
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

    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      throw new UnauthorizedError('User not authenticated')
    }

    const adminSupabase = createAdminClient()

    // Bulk update: apply to all channels for a project
    if (applyToAll) {
      if (!projectId) {
        return NextResponse.json({ error: 'projectId is required for bulk update' }, { status: 400 })
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

      if (project.user_id !== user.id) {
        return NextResponse.json({ error: 'Not authorized' }, { status: 403 })
      }

      // Get workspace token for this project
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: workspaceToken } = await (adminSupabase as any)
        .from('slack_workspace_tokens')
        .select('id')
        .eq('project_id', projectId)
        .single()

      if (!workspaceToken) {
        return NextResponse.json({ error: 'Slack not connected' }, { status: 400 })
      }

      // Update all active channels for this workspace
      const updateData: Record<string, unknown> = { channel_mode: mode }
      if (captureScope !== undefined) {
        updateData.capture_scope = captureScope
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateError, count } = await (adminSupabase as any)
        .from('slack_channels')
        .update(updateData)
        .eq('workspace_token_id', workspaceToken.id)
        .eq('is_active', true)

      if (updateError) {
        console.error('[integrations.slack.channels] Bulk update error:', updateError)
        return NextResponse.json({ error: 'Failed to update channels' }, { status: 500 })
      }

      return NextResponse.json({
        success: true,
        mode,
        captureScope: captureScope || 'external_only',
        updatedCount: count || 0,
      })
    }

    // Single channel update
    if (!channelDbId) {
      return NextResponse.json({ error: 'channelDbId is required' }, { status: 400 })
    }

    // Verify user owns the project for this channel
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: channel, error: channelError } = await (supabase as any)
      .from('slack_channels')
      .select(`
        id,
        slack_workspace_tokens!inner(project_id, projects!inner(user_id))
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

    // Update channel mode using admin client (since RLS doesn't allow updates for regular users)
    const result = await updateSlackChannelMode(
      adminSupabase,
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

    console.error('[integrations.slack.channels] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update channel mode.' }, { status: 500 })
  }
}
