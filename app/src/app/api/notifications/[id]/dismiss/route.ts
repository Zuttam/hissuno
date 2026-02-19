import { NextResponse } from 'next/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { UnauthorizedError } from '@/lib/auth/server'
import { ForbiddenError, getClientForIdentity } from '@/lib/auth/authorization'
import { isSupabaseConfigured } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireUserIdentity()
    const supabase = await getClientForIdentity(identity)
    const { id } = await params

    const { error } = await supabase
      .from('user_notifications')
      .update({ dismissed_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', identity.userId)

    if (error) {
      console.error('[notifications.dismiss.post] failed to dismiss notification', error)
      return NextResponse.json({ error: 'Failed to dismiss notification.' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[notifications.dismiss.post] unexpected error', error)
    return NextResponse.json({ error: 'Failed to dismiss notification.' }, { status: 500 })
  }
}
