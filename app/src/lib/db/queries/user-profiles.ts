/**
 * User Profiles Queries (Drizzle)
 */

import { cache } from 'react'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { userProfiles } from '@/lib/db/schema/app'
import { UnauthorizedError } from '@/lib/auth/server'
import { resolveRequestContext } from '@/lib/db/server'

export type UserProfileRow = typeof userProfiles.$inferSelect
export type UserProfileInsert = typeof userProfiles.$inferInsert

export const getUserProfile = cache(async (): Promise<UserProfileRow | null> => {
  try {
    const { userId } = await resolveRequestContext()

    const row = await db.query.userProfiles.findFirst({
      where: eq(userProfiles.user_id, userId),
    })

    return row ?? null
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[user-profiles.queries] unexpected error while loading profile', error)
    throw error
  }
})
