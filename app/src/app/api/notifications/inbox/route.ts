import { NextResponse } from 'next/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { UnauthorizedError } from '@/lib/auth/server'

export const runtime = 'nodejs'

async function resolveUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new UnauthorizedError('User not authenticated')
  }

  return { supabase, user }
}

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    let query = supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', user.id)
      .eq('channel', 'in_app')
      .is('dismissed_at', null)
      .order('sent_at', { ascending: false })

    if (projectId) {
      query = query.eq('project_id', projectId)
    }

    const { data, error } = await query

    if (error) {
      console.error('[notifications.inbox.get] failed to fetch notifications', error)
      return NextResponse.json({ error: 'Failed to fetch notifications.' }, { status: 500 })
    }

    return NextResponse.json({ notifications: data ?? [] })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[notifications.inbox.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch notifications.' }, { status: 500 })
  }
}
