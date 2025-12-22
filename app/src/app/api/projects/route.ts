import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createCodebase, createGitHubCodebase } from '@/lib/codebase'
import { selectGitignore } from '@/lib/projects/source-code-utils'
import { UnauthorizedError } from '@/lib/auth/server'
import type { Database } from '@/types/supabase'
import {
  createClient,
  isSupabaseConfigured,
} from '@/lib/supabase/server'

export const runtime = 'nodejs'

async function resolveUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new UnauthorizedError('User not authenticated')
  }

  return { supabase, user }
}

export async function GET() {
  if (!isSupabaseConfigured()) {
    console.error('[projects.get] Supabase must be configured to list projects')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    const { data, error } = await supabase
      .from('projects')
      .select('*, source_code:source_codes(id, kind, storage_uri, repository_url, repository_branch, created_at, updated_at)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('[projects.get] failed to list projects', error)
      return NextResponse.json({ error: 'Unable to load projects.' }, { status: 500 })
    }

    return NextResponse.json({ projects: data ?? [] })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[projects.get] unexpected error', error)
    return NextResponse.json({ error: 'Unable to load projects.' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const formData = await request.formData()

  const name = formData.get('name')?.toString().trim()
  if (!name) {
    return NextResponse.json({ error: 'Project name is required.' }, { status: 400 })
  }

  const description = formData.get('description')?.toString().trim() || null
  const codebaseSource = formData.get('codebaseSource')?.toString().trim() || 'none'

  // GitHub source params
  const repositoryUrl = formData.get('repositoryUrl')?.toString().trim() || null
  const repositoryBranch = formData.get('repositoryBranch')?.toString().trim() || null

  // Upload folder source params
  const codebaseFiles = formData
    .getAll('codebase')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0)
  const gitignoreUpload = formData.get('gitignore')
  const explicitGitignore =
    gitignoreUpload instanceof File && gitignoreUpload.size > 0 ? gitignoreUpload : null
  const gitignoreSelection = selectGitignore(codebaseFiles, explicitGitignore)
  const gitignoreFile = gitignoreSelection?.file ?? null

  const hasFilesToUpload = codebaseFiles.length > 0
  const hasGitHubSource = codebaseSource === 'github' && repositoryUrl && repositoryBranch
  const id = randomUUID()

  if (!isSupabaseConfigured()) {
    console.error('[projects.post] Supabase must be configured to create projects')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()

    let codebaseId: string | null = null

    // Create GitHub codebase if provided
    if (hasGitHubSource) {
      const { codebase } = await createGitHubCodebase({
        repositoryUrl,
        repositoryBranch,
        userId: user.id,
      })
      codebaseId = codebase.id
    }
    // Create codebase from uploaded files if provided
    else if (hasFilesToUpload) {
      const { codebase } = await createCodebase({
        files: codebaseFiles,
        gitignore: gitignoreFile,
        projectId: id,
        userId: user.id,
      })

      codebaseId = codebase.id
    }

    const projectInsert: Database['public']['Tables']['projects']['Insert'] = {
      id,
      name,
      description,
      source_code_id: codebaseId,
      user_id: user.id,
    }

    const { data: createdProject, error: projectInsertError } = await supabase
      .from('projects')
      .insert(projectInsert)
      .select('*, source_code:source_codes(id, kind, storage_uri, repository_url, repository_branch, created_at, updated_at)')
      .single()

    if (projectInsertError || !createdProject) {
      console.error('[projects.post] failed to create project', projectInsertError)
      return NextResponse.json({ error: 'Failed to create project.' }, { status: 500 })
    }

    return NextResponse.json({ project: createdProject })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    console.error('[projects.post] unexpected error', error)
    return NextResponse.json({ error: 'Failed to create project.' }, { status: 500 })
  }
}
