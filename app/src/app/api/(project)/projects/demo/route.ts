import { NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { createProjectWithDemoData } from '@/lib/demo/create-project'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema/app'
import { eq, and, count as drizzleCount } from 'drizzle-orm'

export const runtime = 'nodejs'

/**
 * POST /api/projects/demo
 * Creates a demo project with pre-populated data.
 */
export async function POST() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    if (identity.type !== 'user') {
      return NextResponse.json({ error: 'API keys cannot create demo projects.' }, { status: 403 })
    }
    // Guard: only one demo project per user
    const [existingDemoCount] = await db
      .select({ count: drizzleCount() })
      .from(projects)
      .where(
        and(
          eq(projects.user_id, identity.userId),
          eq(projects.is_demo, true)
        )
      )

    if (existingDemoCount && existingDemoCount.count > 0) {
      return NextResponse.json({ error: 'You already have a demo project.' }, { status: 409 })
    }

    const { project } = await createProjectWithDemoData({
      userId: identity.userId,
      isDemoProject: true,
    })

    return NextResponse.json({ project })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[projects.demo.post] unexpected error', error)
    return NextResponse.json({ error: 'Failed to create demo project.' }, { status: 500 })
  }
}
