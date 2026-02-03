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
      .select('notification_preferences, notifications_silenced')
      .eq('user_id', user.id)
      .single()

    if (error && error.code !== 'PGRST116') {
      console.error('[notification-preferences.get] failed to fetch preferences', error)
      return NextResponse.json({ error: 'Unable to load preferences.' }, { status: 500 })
    }

    const preferences = resolvePreferences(profile?.notification_preferences ?? null)
    const silenced = profile?.notifications_silenced ?? false

    // Check if user has any projects with Slack tokens
    const adminClient = createAdminClient()
    const { data: projects } = await adminClient
      .from('projects')
      .select('id')
      .eq('user_id', user.id)

    let slackAvailable = false
    if (projects && projects.length > 0) {
      const projectIds = projects.map((p) => p.id)
      const { data: tokens } = await adminClient
        .from('slack_workspace_tokens')
        .select('id')
        .in('project_id', projectIds)
        .limit(1)

      slackAvailable = !!tokens && tokens.length > 0
    }

    return NextResponse.json({ preferences, silenced, slackAvailable })
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

    const { preferences, silenced } = body as {
      preferences?: NotificationPreferences
      silenced?: boolean
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
