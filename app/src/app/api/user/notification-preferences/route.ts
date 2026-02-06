import { NextResponse } from 'next/server'
import { requireSessionUser, UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured, createAdminClient } from '@/lib/supabase/server'
import { resolvePreferences, type NotificationPreferences } from '@/types/notification-preferences'
import { resolveSlackUserId } from '@/lib/notifications/slack-notifications'

export const runtime = 'nodejs'

export async function GET() {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const user = await requireSessionUser()
    const supabase = await createClient()

    // Fetch user profile preferences
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('notification_preferences, notifications_silenced, slack_notification_channel')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('[notification-preferences.get] failed to fetch preferences', error)
      return NextResponse.json({ error: 'Unable to load preferences.' }, { status: 500 })
    }

    const preferences = resolvePreferences(profile?.notification_preferences ?? null)
    const silenced = profile?.notifications_silenced ?? false
    const slackNotificationChannel = profile?.slack_notification_channel ?? null

    // Check if user has any projects with Slack tokens and fetch available channels
    const adminClient = createAdminClient()
    const { data: projects } = await adminClient
      .from('projects')
      .select('id')
      .eq('user_id', user.id)

    let slackAvailable = false
    const availableSlackChannels: { id: string; name: string }[] = []

    if (projects && projects.length > 0) {
      const projectIds = projects.map((p) => p.id)
      const { data: tokens } = await adminClient
        .from('slack_workspace_tokens')
        .select('id, bot_token, project_id')
        .in('project_id', projectIds)

      slackAvailable = !!tokens && tokens.length > 0

      // Fetch available channels from all connected Slack workspaces
      if (tokens && tokens.length > 0) {
        const seenChannels = new Set<string>()
        for (const token of tokens) {
          if (!token.bot_token) continue
          try {
            const response = await fetch('https://slack.com/api/conversations.list', {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${token.bot_token}`,
                'Content-Type': 'application/x-www-form-urlencoded',
              },
              body: new URLSearchParams({
                types: 'public_channel,private_channel',
                exclude_archived: 'true',
                limit: '200',
              }),
            })
            const data = await response.json()
            if (data.ok && data.channels) {
              for (const channel of data.channels) {
                // Only include channels where the bot is a member
                if (channel.is_member && !seenChannels.has(channel.id)) {
                  seenChannels.add(channel.id)
                  availableSlackChannels.push({
                    id: channel.id,
                    name: channel.name,
                  })
                }
              }
            }
          } catch (err) {
            console.error('[notification-preferences.get] failed to fetch Slack channels', err)
          }
        }
        // Sort channels alphabetically by name
        availableSlackChannels.sort((a, b) => a.name.localeCompare(b.name))
      }
    }

    return NextResponse.json({
      preferences,
      silenced,
      slackAvailable,
      slackNotificationChannel,
      availableSlackChannels,
    })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[notification-preferences.get] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load preferences.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const user = await requireSessionUser()
    const supabase = await createClient()
    const body = await request.json()

    const { preferences, silenced, slackNotificationChannel } = body as {
      preferences?: NotificationPreferences
      silenced?: boolean
      slackNotificationChannel?: string | null
    }

    const updateData: Record<string, unknown> = {
      user_id: user.id,
    }

    if (preferences !== undefined) {
      updateData.notification_preferences = preferences
    }

    if (silenced !== undefined) {
      updateData.notifications_silenced = silenced
    }

    if (slackNotificationChannel !== undefined) {
      updateData.slack_notification_channel = slackNotificationChannel
    }

    const { error } = await supabase
      .from('user_profiles')
      .upsert(updateData, { onConflict: 'user_id' })
      .select()
      .single()

    if (error) {
      console.error('[notification-preferences.post] failed to save preferences', error)
      return NextResponse.json({ error: 'Unable to save preferences.' }, { status: 500 })
    }

    // If Slack is being enabled for any type, proactively resolve the Slack user ID
    if (preferences) {
      const hasSlackEnabled = Object.values(preferences).some((pref) => pref?.slack)
      if (hasSlackEnabled) {
        // Fire-and-forget: resolve Slack user ID in background
        void resolveSlackUserId(user.id).catch((err) => {
          console.error('[notification-preferences.post] failed to resolve Slack user', err)
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[notification-preferences.post] unexpected error', error)
    return NextResponse.json({ error: 'Unable to save preferences.' }, { status: 500 })
  }
}
