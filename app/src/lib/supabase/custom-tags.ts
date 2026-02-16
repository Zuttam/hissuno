import { cache } from 'react'
import { UnauthorizedError } from '@/lib/auth/server'
import { createAdminClient, createRequestScopedClient, isSupabaseConfigured, isServiceRoleConfigured } from './server'
import type { CustomTagRecord } from '@/types/session'

const MAX_TAGS_PER_PROJECT = 10

/**
 * Lists custom tags for a project. Requires authenticated user context.
 * Only returns tags for projects owned by the current user.
 */
export const listProjectCustomTags = cache(async (projectId: string): Promise<CustomTagRecord[]> => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const { supabase } = await createRequestScopedClient()

    // Verify user has access to this project (RLS handles membership)
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single()

    if (!project) {
      throw new UnauthorizedError('Project not found or access denied.')
    }

    // Get custom tags ordered by position
    const { data, error } = await supabase
      .from('custom_tags')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true })

    if (error) {
      console.error('[supabase.custom-tags] failed to list custom tags', error)
      throw new Error('Unable to load custom tags from Supabase.')
    }

    return (data ?? []) as CustomTagRecord[]
  } catch (error) {
    console.error('[supabase.custom-tags] unexpected error listing custom tags', error)
    throw error
  }
})

/**
 * Gets custom tags for a project using admin client (no auth).
 * Used by workflows and internal services.
 */
export async function getProjectCustomTags(projectId: string): Promise<CustomTagRecord[]> {
  if (!isServiceRoleConfigured()) {
    console.warn('[supabase.custom-tags] service role not configured, returning empty tags')
    return []
  }

  try {
    const supabase = createAdminClient()

    const { data, error } = await supabase
      .from('custom_tags')
      .select('*')
      .eq('project_id', projectId)
      .order('position', { ascending: true })

    if (error) {
      console.error('[supabase.custom-tags] failed to get custom tags', error)
      return []
    }

    return (data ?? []) as CustomTagRecord[]
  } catch (error) {
    console.error('[supabase.custom-tags] unexpected error getting custom tags', error)
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
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const { supabase } = await createRequestScopedClient()

    // Verify user has access to this project (RLS handles membership)
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .single()

    if (!project) {
      throw new UnauthorizedError('Project not found or access denied.')
    }

    // Get existing tags
    const { data: existingTags, error: fetchError } = await supabase
      .from('custom_tags')
      .select('*')
      .eq('project_id', projectId)

    if (fetchError) {
      console.error('[supabase.custom-tags] failed to fetch existing tags', fetchError)
      throw new Error('Unable to load existing tags.')
    }

    const existingTagsById = new Map(
      (existingTags ?? []).map((tag) => [tag.id, tag as CustomTagRecord])
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
        const { error: deleteError } = await supabase
          .from('custom_tags')
          .delete()
          .eq('id', existingTag.id)

        if (deleteError) {
          console.error('[supabase.custom-tags] failed to delete tag', existingTag.id, deleteError)
          throw new Error('Unable to delete tag.')
        }

        result.deleted.push(existingTag.id)
      }
    }

    // Create new tags
    for (const newTag of newTags) {
      const { data: created, error: createError } = await supabase
        .from('custom_tags')
        .insert({
          project_id: projectId,
          name: newTag.name,
          slug: newTag.slug,
          description: newTag.description,
          color: newTag.color,
          position: newTag.position,
        })
        .select()
        .single()

      if (createError) {
        if (createError.code === '23505') {
          throw new Error(`A tag with slug "${newTag.slug}" already exists in this project.`)
        }
        console.error('[supabase.custom-tags] failed to create tag', createError)
        throw new Error('Unable to create tag.')
      }

      result.created.push(created as CustomTagRecord)
    }

    // Update existing tags that have changes
    for (const incomingTag of existingIncomingTags) {
      const existingTag = existingTagsById.get(incomingTag.id)
      if (!existingTag) {
        // Tag ID doesn't exist in DB - skip (shouldn't happen)
        console.warn('[supabase.custom-tags] tag ID not found in DB', incomingTag.id)
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
        const { data: updated, error: updateError } = await supabase
          .from('custom_tags')
          .update({
            name: incomingTag.name,
            slug: incomingTag.slug,
            description: incomingTag.description,
            color: incomingTag.color,
            position: incomingTag.position,
          })
          .eq('id', incomingTag.id)
          .select()
          .single()

        if (updateError) {
          if (updateError.code === '23505') {
            throw new Error(`A tag with slug "${incomingTag.slug}" already exists in this project.`)
          }
          console.error('[supabase.custom-tags] failed to update tag', incomingTag.id, updateError)
          throw new Error('Unable to update tag.')
        }

        result.updated.push(updated as CustomTagRecord)
      }
    }

    return result
  } catch (error) {
    console.error('[supabase.custom-tags] unexpected error syncing custom tags', error)
    throw error
  }
}
