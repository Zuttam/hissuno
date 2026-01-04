import { NextRequest, NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'

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
