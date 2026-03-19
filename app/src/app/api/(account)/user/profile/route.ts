import { NextResponse } from 'next/server'
import { requireUserIdentity } from '@/lib/auth/identity'
import { UnauthorizedError } from '@/lib/auth/server'
import { ForbiddenError } from '@/lib/auth/authorization'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema/app'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireUserIdentity()

    const [profile] = await db
      .select()
      .from(userProfiles)
      .where(eq(userProfiles.user_id, identity.userId))
      .limit(1)

    return NextResponse.json({ profile: profile ?? null })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[user.profile.get] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load profile.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireUserIdentity()
    const body = await request.json()

    const {
      fullName,
      companyName,
      role,
      companySize,
      communicationChannels,
    } = body

    // Build update object - only include fields that were explicitly provided
    // This ensures partial updates don't reset other fields
    const updateData: Record<string, unknown> = {
      user_id: identity.userId,
    }

    // Profile fields - only update if provided (not undefined)
    if (fullName !== undefined) {
      updateData.full_name = fullName ?? null
    }
    if (companyName !== undefined) {
      updateData.company_name = companyName ?? null
    }
    if (role !== undefined) {
      updateData.role = role ?? null
    }
    if (companySize !== undefined) {
      updateData.company_size = companySize || null
    }
    if (communicationChannels !== undefined) {
      updateData.communication_channels = communicationChannels ?? []
    }

    // Upsert profile with partial data
    const [profile] = await db
      .insert(userProfiles)
      .values(updateData as typeof userProfiles.$inferInsert)
      .onConflictDoUpdate({
        target: userProfiles.user_id,
        set: updateData as Partial<typeof userProfiles.$inferInsert>,
      })
      .returning()

    return NextResponse.json({ profile })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[user.profile.post] unexpected error', error)
    return NextResponse.json({ error: 'Unable to save profile.' }, { status: 500 })
  }
}
