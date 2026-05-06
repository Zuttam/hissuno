/**
 * Projects Queries (Drizzle)
 */

import { eq, desc, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projects, codebases } from '@/lib/db/schema/app'
import { getUserProjectIds } from '@/lib/db/server'

export type ProjectRow = typeof projects.$inferSelect
export type ProjectInsert = typeof projects.$inferInsert

export type CodebaseRow = typeof codebases.$inferSelect

export async function listProjects(userId: string): Promise<ProjectRow[]> {
  try {
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
}

export async function getProjectById(projectId: string): Promise<ProjectRow | null> {
  try {
    const row = await db.query.projects.findFirst({
      where: eq(projects.id, projectId),
    })

    return row ?? null
  } catch (error) {
    console.error('[projects.queries] unexpected error while loading project', projectId, error)
    throw error
  }
}

export async function updateProjectMetadata(
  projectId: string,
  updates: Partial<Pick<ProjectRow, 'name' | 'description'>>
): Promise<ProjectRow> {
  try {
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
