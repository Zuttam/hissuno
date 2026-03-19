/**
 * Projects Queries (Drizzle)
 */

import { cache } from 'react'
import { eq, desc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, sourceCodes } from '@/lib/db/schema/app'
import { UnauthorizedError } from '@/lib/auth/server'
import { resolveRequestContext, getUserProjectIds } from '@/lib/db/server'
import { hasProjectAccess } from '@/lib/auth/project-members'

export type ProjectRow = typeof projects.$inferSelect
export type ProjectInsert = typeof projects.$inferInsert

export type CodebaseRow = typeof sourceCodes.$inferSelect

export const listProjects = cache(async (): Promise<ProjectRow[]> => {
  try {
    const { userId } = await resolveRequestContext()

    const projectIds = await getUserProjectIds(userId)
    if (projectIds.length === 0) {
      return []
    }

    const rows = await db
      .select()
      .from(projects)
      .where(inArray(projects.id, projectIds))
      .orderBy(desc(projects.created_at))

    return rows
  } catch (error) {
    console.error('[projects.queries] unexpected error while listing projects', error)
    throw error
  }
})

export const getProjectById = cache(async (projectId: string): Promise<ProjectRow | null> => {
  try {
    const { userId } = await resolveRequestContext()

    const hasAccess = await hasProjectAccess(projectId, userId)
    if (!hasAccess) {
      return null
    }

    const row = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    })

    return row ?? null
  } catch (error) {
    console.error('[projects.queries] unexpected error while loading project', projectId, error)
    throw error
  }
})

export async function updateProjectMetadata(
  projectId: string,
  updates: Partial<Pick<ProjectRow, 'name' | 'description'>>
): Promise<ProjectRow> {
  try {
    const { userId } = await resolveRequestContext()

    const hasAccess = await hasProjectAccess(projectId, userId)
    if (!hasAccess) {
      throw new UnauthorizedError('You do not have access to this project.')
    }

    const [row] = await db
      .update(projects)
      .set(updates)
      .where(eq(projects.id, projectId))
      .returning()

    if (!row) {
      throw new Error('Unable to update project metadata.')
    }

    return row
  } catch (error) {
    console.error('[projects.queries] unexpected error while updating project metadata', projectId, error)
    throw error
  }
}
