/**
 * Custom Tags Queries (Drizzle)
 */

import { eq, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { customTags } from '@/lib/db/schema/app'
import { isUniqueViolation } from '@/lib/db/errors'
import type { CustomTagRecord } from '@/types/session'

export type CustomTagRow = typeof customTags.$inferSelect
export type CustomTagInsert = typeof customTags.$inferInsert

const MAX_TAGS_PER_PROJECT = 10

/**
 * Lists custom tags for a project.
 */
export async function listProjectCustomTags(projectId: string): Promise<CustomTagRecord[]> {
  try {
    const rows = await db
      .select()
      .from(customTags)
      .where(eq(customTags.project_id, projectId))
      .orderBy(asc(customTags.position))

    return rows as unknown as CustomTagRecord[]
  } catch (error) {
    console.error('[db.custom-tags] unexpected error listing custom tags', error)
    throw error
  }
}

/**
 * Gets custom tags for a project using admin client (no auth).
 * Used by workflows and internal services.
 */
export async function getProjectCustomTags(projectId: string): Promise<CustomTagRecord[]> {
  try {
    const rows = await db
      .select()
      .from(customTags)
      .where(eq(customTags.project_id, projectId))
      .orderBy(asc(customTags.position))

    return rows as unknown as CustomTagRecord[]
  } catch (error) {
    console.error('[db.custom-tags] unexpected error getting custom tags', error)
    return []
  }
}

/**
 * Input for syncing custom tags
 */
export interface SyncTagInput {
  id: string // Real ID for existing tags, temp_${timestamp} for new tags
  name: string
  slug: string
  description: string
  color: string
  position: number
}

/**
 * Result of syncing custom tags
 */
export interface SyncTagsResult {
  created: CustomTagRecord[]
  updated: CustomTagRecord[]
  deleted: string[]
}

/**
 * Syncs custom tags for a project. Compares incoming tags with existing tags
 * and performs create/update/delete operations as needed.
 *
 * Tags with IDs starting with 'temp_' are treated as new and will be created.
 * Tags that exist in DB but not in input will be deleted.
 * Tags that exist in both will be updated if changed.
 */
export async function syncCustomTags(
  projectId: string,
  incomingTags: SyncTagInput[]
): Promise<SyncTagsResult> {
  try {
    // Get existing tags
    const existingRows = await db
      .select()
      .from(customTags)
      .where(eq(customTags.project_id, projectId))

    const existingTagsById = new Map(
      existingRows.map((tag) => [tag.id, tag as unknown as CustomTagRecord])
    )
    const incomingTagsById = new Map(incomingTags.map((tag) => [tag.id, tag]))

    const result: SyncTagsResult = {
      created: [],
      updated: [],
      deleted: [],
    }

    // Determine new tags (temp_ prefix) and existing tags
    const newTags = incomingTags.filter((tag) => tag.id.startsWith('temp_'))
    const existingIncomingTags = incomingTags.filter((tag) => !tag.id.startsWith('temp_'))

    // Check total tag count
    const existingCount = existingTagsById.size
    const newCount = newTags.length
    const deletedCount = Array.from(existingTagsById.keys()).filter(
      (id) => !incomingTagsById.has(id)
    ).length
    const finalCount = existingCount + newCount - deletedCount

    if (finalCount > MAX_TAGS_PER_PROJECT) {
      throw new Error(`Maximum of ${MAX_TAGS_PER_PROJECT} custom tags per project.`)
    }

    // Delete tags that are no longer in the list
    for (const existingTag of existingTagsById.values()) {
      if (!incomingTagsById.has(existingTag.id)) {
        await db
          .delete(customTags)
          .where(eq(customTags.id, existingTag.id))

        result.deleted.push(existingTag.id)
      }
    }

    // Create new tags
    for (const newTag of newTags) {
      try {
        const [created] = await db
          .insert(customTags)
          .values({
            project_id: projectId,
            name: newTag.name,
            slug: newTag.slug,
            description: newTag.description,
            color: newTag.color,
            position: newTag.position,
          })
          .returning()

        result.created.push(created as unknown as CustomTagRecord)
      } catch (err: unknown) {
        if (isUniqueViolation(err)) {
          throw new Error(`A tag with slug "${newTag.slug}" already exists in this project.`)
        }
        console.error('[db.custom-tags] failed to create tag', err)
        throw new Error('Unable to create tag.')
      }
    }

    // Update existing tags that have changes
    for (const incomingTag of existingIncomingTags) {
      const existingTag = existingTagsById.get(incomingTag.id)
      if (!existingTag) {
        console.warn('[db.custom-tags] tag ID not found in DB', incomingTag.id)
        continue
      }

      // Check if anything changed
      const hasChanges =
        existingTag.name !== incomingTag.name ||
        existingTag.slug !== incomingTag.slug ||
        existingTag.description !== incomingTag.description ||
        existingTag.color !== incomingTag.color ||
        existingTag.position !== incomingTag.position

      if (hasChanges) {
        try {
          const [updated] = await db
            .update(customTags)
            .set({
              name: incomingTag.name,
              slug: incomingTag.slug,
              description: incomingTag.description,
              color: incomingTag.color,
              position: incomingTag.position,
            })
            .where(eq(customTags.id, incomingTag.id))
            .returning()

          result.updated.push(updated as unknown as CustomTagRecord)
        } catch (err: unknown) {
          if (isUniqueViolation(err)) {
            throw new Error(`A tag with slug "${incomingTag.slug}" already exists in this project.`)
          }
          console.error('[db.custom-tags] failed to update tag', incomingTag.id, err)
          throw new Error('Unable to update tag.')
        }
      }
    }

    return result
  } catch (error) {
    console.error('[db.custom-tags] unexpected error syncing custom tags', error)
    throw error
  }
}
