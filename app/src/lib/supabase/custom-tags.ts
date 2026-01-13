import { cache } from 'react'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, createAdminClient, isSupabaseConfigured, isServiceRoleConfigured } from './server'
import type { CustomTagRecord, CustomTagInput } from '@/types/session'

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
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError) {
      console.error('[supabase.custom-tags] failed to resolve user for listProjectCustomTags', userError)
      throw new UnauthorizedError('Unable to resolve user context.')
    }

    if (!user) {
      throw new UnauthorizedError()
    }

    // Verify project ownership
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
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
 * Gets a single custom tag by ID. Requires authenticated user context.
 */
export async function getCustomTagById(tagId: string): Promise<CustomTagRecord | null> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new UnauthorizedError()
    }

    const { data, error } = await supabase
      .from('custom_tags')
      .select('*')
      .eq('id', tagId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('[supabase.custom-tags] failed to get custom tag', error)
      throw new Error('Unable to load custom tag from Supabase.')
    }

    // Verify project ownership through RLS (already enforced, but double-check)
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', data.project_id)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      return null
    }

    return data as CustomTagRecord
  } catch (error) {
    console.error('[supabase.custom-tags] unexpected error getting custom tag', error)
    throw error
  }
}

/**
 * Creates a new custom tag for a project. Requires authenticated user context.
 */
export async function createCustomTag(
  projectId: string,
  input: CustomTagInput
): Promise<CustomTagRecord> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new UnauthorizedError()
    }

    // Verify project ownership
    const { data: project } = await supabase
      .from('projects')
      .select('id')
      .eq('id', projectId)
      .eq('user_id', user.id)
      .single()

    if (!project) {
      throw new UnauthorizedError('Project not found or access denied.')
    }

    // Check tag count
    const { count } = await supabase
      .from('custom_tags')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)

    if ((count ?? 0) >= MAX_TAGS_PER_PROJECT) {
      throw new Error(`Maximum of ${MAX_TAGS_PER_PROJECT} custom tags per project.`)
    }

    // Get next position
    const { data: existingTags } = await supabase
      .from('custom_tags')
      .select('position')
      .eq('project_id', projectId)
      .order('position', { ascending: false })
      .limit(1)

    const nextPosition = existingTags && existingTags.length > 0
      ? existingTags[0].position + 1
      : 0

    const { data, error } = await supabase
      .from('custom_tags')
      .insert({
        project_id: projectId,
        name: input.name,
        slug: input.slug,
        description: input.description,
        color: input.color ?? 'info',
        position: input.position ?? nextPosition,
      })
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new Error('A tag with this slug already exists in this project.')
      }
      console.error('[supabase.custom-tags] failed to create custom tag', error)
      throw new Error('Unable to create custom tag.')
    }

    return data as CustomTagRecord
  } catch (error) {
    console.error('[supabase.custom-tags] unexpected error creating custom tag', error)
    throw error
  }
}

/**
 * Updates an existing custom tag. Requires authenticated user context.
 */
export async function updateCustomTag(
  tagId: string,
  input: Partial<CustomTagInput>
): Promise<CustomTagRecord> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new UnauthorizedError()
    }

    // Build update object (only include provided fields)
    const updates: Record<string, unknown> = {}
    if (input.name !== undefined) updates.name = input.name
    if (input.slug !== undefined) updates.slug = input.slug
    if (input.description !== undefined) updates.description = input.description
    if (input.color !== undefined) updates.color = input.color
    if (input.position !== undefined) updates.position = input.position

    if (Object.keys(updates).length === 0) {
      const existing = await getCustomTagById(tagId)
      if (!existing) {
        throw new Error('Custom tag not found.')
      }
      return existing
    }

    const { data, error } = await supabase
      .from('custom_tags')
      .update(updates)
      .eq('id', tagId)
      .select()
      .single()

    if (error) {
      if (error.code === '23505') {
        throw new Error('A tag with this slug already exists in this project.')
      }
      if (error.code === 'PGRST116') {
        throw new Error('Custom tag not found.')
      }
      console.error('[supabase.custom-tags] failed to update custom tag', error)
      throw new Error('Unable to update custom tag.')
    }

    return data as CustomTagRecord
  } catch (error) {
    console.error('[supabase.custom-tags] unexpected error updating custom tag', error)
    throw error
  }
}

/**
 * Deletes a custom tag. Requires authenticated user context.
 * Note: This does NOT remove the slug from existing sessions.tags arrays.
 */
export async function deleteCustomTag(tagId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new UnauthorizedError()
    }

    const { error } = await supabase
      .from('custom_tags')
      .delete()
      .eq('id', tagId)

    if (error) {
      console.error('[supabase.custom-tags] failed to delete custom tag', error)
      throw new Error('Unable to delete custom tag.')
    }

    return true
  } catch (error) {
    console.error('[supabase.custom-tags] unexpected error deleting custom tag', error)
    throw error
  }
}

/**
 * Checks if a project can add more custom tags.
 */
export async function canAddCustomTag(projectId: string): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    return false
  }

  try {
    const supabase = await createClient()

    const { count, error } = await supabase
      .from('custom_tags')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', projectId)

    if (error) {
      console.error('[supabase.custom-tags] failed to check tag count', error)
      return false
    }

    return (count ?? 0) < MAX_TAGS_PER_PROJECT
  } catch (error) {
    console.error('[supabase.custom-tags] unexpected error checking tag count', error)
    return false
  }
}

/**
 * Updates positions for multiple tags at once (for reordering).
 */
export async function updateTagPositions(
  tagPositions: Array<{ id: string; position: number }>
): Promise<boolean> {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase must be configured.')
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      throw new UnauthorizedError()
    }

    // Update each tag's position
    for (const { id, position } of tagPositions) {
      const { error } = await supabase
        .from('custom_tags')
        .update({ position })
        .eq('id', id)

      if (error) {
        console.error('[supabase.custom-tags] failed to update tag position', error)
        throw new Error('Unable to update tag positions.')
      }
    }

    return true
  } catch (error) {
    console.error('[supabase.custom-tags] unexpected error updating tag positions', error)
    throw error
  }
}
