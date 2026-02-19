import { NextResponse } from 'next/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { UnauthorizedError } from '@/lib/auth/server'
import { ForbiddenError, getClientForIdentity } from '@/lib/auth/authorization'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireUserIdentity()
    const supabase = await getClientForIdentity(identity)
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    let query = supabase
      .from('user_notifications')
      .select('*')
      .eq('user_id', identity.userId)
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
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[notifications.inbox.get] unexpected error', error)
    return NextResponse.json({ error: 'Failed to fetch notifications.' }, { status: 500 })
  }
}
