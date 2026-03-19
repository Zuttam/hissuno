import { NextResponse } from 'next/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { UnauthorizedError } from '@/lib/auth/server'
import { ForbiddenError } from '@/lib/auth/authorization'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { userNotifications } from '@/lib/db/schema/app'
import { eq, and } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireUserIdentity()
    const { id } = await params

    await db
      .update(userNotifications)
      .set({ dismissed_at: new Date() })
      .where(and(eq(userNotifications.id, id), eq(userNotifications.user_id, identity.userId)))

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
