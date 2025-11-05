import { cache } from 'react'
import { createClient } from './server'
import type { Database } from '@/types/supabase'

type ProjectsTable = Database['public']['Tables']['projects']
type ProjectAnalysesTable = Database['public']['Tables']['project_analyses']

export type ProjectRecord = ProjectsTable['Row']
export type ProjectAnalysisRecord = ProjectAnalysesTable['Row']
export type ProjectWithAnalyses = ProjectRecord & {
  project_analyses: ProjectAnalysisRecord[]
}

const selectProjectWithAnalyses = '*, project_analyses(*)'

export const listProjects = cache(async (): Promise<ProjectWithAnalyses[]> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select(selectProjectWithAnalyses)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[supabase.projects] failed to list projects', error)
    throw new Error('Unable to load projects from Supabase.')
  }

  return (data ?? []) as ProjectWithAnalyses[]
})

export const getProjectById = cache(async (projectId: string): Promise<ProjectWithAnalyses | null> => {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select(selectProjectWithAnalyses)
    .eq('id', projectId)
    .order('created_at', { referencedTable: 'project_analyses', ascending: false })
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('[supabase.projects] failed to load project', projectId, error)
    throw new Error('Unable to load project from Supabase.')
  }

  return data as ProjectWithAnalyses
})

export async function updateProjectMetadata(
  projectId: string,
  updates: Partial<Pick<ProjectRecord, 'name' | 'description' | 'repository_url' | 'repository_branch'>>
): Promise<ProjectRecord> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', projectId)
    .select()
    .single()

  if (error) {
    console.error('[supabase.projects] failed to update project metadata', projectId, error)
    throw new Error('Unable to update project metadata.')
  }

  return data
}

