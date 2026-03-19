import { NextResponse } from 'next/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { UnauthorizedError } from '@/lib/auth/server'
import { ForbiddenError } from '@/lib/auth/authorization'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { userNotifications } from '@/lib/db/schema/app'
import { eq, and, isNull, desc } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireUserIdentity()
    const { searchParams } = new URL(request.url)
    const projectId = searchParams.get('projectId')

    const conditions = [
      eq(userNotifications.user_id, identity.userId),
      eq(userNotifications.channel, 'in_app'),
      isNull(userNotifications.dismissed_at),
    ]

    if (projectId) {
      conditions.push(eq(userNotifications.project_id, projectId))
    }

    const notifications = await db
      .select()
      .from(userNotifications)
      .where(and(...conditions))
      .orderBy(desc(userNotifications.sent_at))

    return NextResponse.json({ notifications })
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
