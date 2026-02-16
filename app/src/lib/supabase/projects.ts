import { cache } from 'react'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import type { Database } from '@/types/supabase'

type ProjectsTable = Database['public']['Tables']['projects']
type SourceCodesTable = Database['public']['Tables']['source_codes']

export type ProjectRecord = ProjectsTable['Row']
export type CodebaseRecord = SourceCodesTable['Row']

export const listProjects = cache(async (): Promise<ProjectRecord[]> => {
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
      console.error('[projects.queries] failed to resolve user for listProjects', userError)
      throw new UnauthorizedError('Unable to resolve user context.')
    }

    if (!user) {
      throw new UnauthorizedError()
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[projects.queries] failed to list projects', error)
      throw new Error('Unable to load projects from Supabase.')
    }

    return (data ?? []) as ProjectRecord[]
  } catch (error) {
    console.error('[projects.queries] unexpected error while listing projects', error)
    throw error
  }
})

export const getProjectById = cache(async (projectId: string): Promise<ProjectRecord | null> => {
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
      console.error('[projects.queries] failed to resolve user for getProjectById', projectId, userError)
      throw new UnauthorizedError('Unable to resolve user context.')
    }

    if (!user) {
      throw new UnauthorizedError()
    }

    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return null
      }
      console.error('[projects.queries] failed to load project', projectId, error)
      throw new Error('Unable to load project from Supabase.')
    }

    return data as ProjectRecord
  } catch (error) {
    console.error('[projects.queries] unexpected error while loading project', projectId, error)
    throw error
  }
})

export async function updateProjectMetadata(
  projectId: string,
  updates: Partial<Pick<ProjectRecord, 'name' | 'description'>>
): Promise<ProjectRecord> {
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
      console.error('[projects.queries] failed to resolve user for updateProjectMetadata', projectId, userError)
      throw new UnauthorizedError('Unable to resolve user context.')
    }

    if (!user) {
      throw new UnauthorizedError()
    }

    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single()

    if (error) {
      console.error('[projects.queries] failed to update project metadata', projectId, error)
      throw new Error('Unable to update project metadata.')
    }

    return data
  } catch (error) {
    console.error('[projects.queries] unexpected error while updating project metadata', projectId, error)
    throw error
  }
}
