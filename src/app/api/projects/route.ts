import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { persistProjectArchive } from '@/lib/analyzer/uploads'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('projects')
    .select('*, project_analyses(id, status, summary, created_at)')
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[projects.get] failed to list projects', error)
    return NextResponse.json({ error: 'Unable to load projects.' }, { status: 500 })
  }

  return NextResponse.json({ projects: data ?? [] })
}

export async function POST(request: Request) {
  const formData = await request.formData()

  const name = formData.get('name')?.toString().trim()
  if (!name) {
    return NextResponse.json({ error: 'Project name is required.' }, { status: 400 })
  }

  const description = formData.get('description')?.toString().trim() || null
  const repositoryUrl = formData.get('repositoryUrl')?.toString().trim() || null
  const repositoryBranch = formData.get('repositoryBranch')?.toString().trim() || null
  const prompt = formData.get('prompt')?.toString().trim() || null

  const pathValue = formData.get('path')?.toString().trim() || null
  const upload = formData.get('upload')

  const hasUpload = upload instanceof File && upload.size > 0
  const hasPath = typeof pathValue === 'string' && pathValue.length > 0

  if (hasUpload && hasPath) {
    return NextResponse.json(
      { error: 'Provide either a local path or an uploaded archive, not both.' },
      { status: 400 }
    )
  }

  if (!hasUpload && !hasPath) {
    return NextResponse.json(
      { error: 'Provide a local path or upload a project archive to onboard a project.' },
      { status: 400 }
    )
  }

  const id = randomUUID()
  let archiveTempPath: string | null = null
  let sourceKind: 'path' | 'upload'
  let sourceValue: string

  if (hasUpload) {
    const { path } = await persistProjectArchive(id, upload as File)
    archiveTempPath = path
    sourceKind = 'upload'
    sourceValue = path
  } else {
    sourceKind = 'path'
    sourceValue = pathValue as string
    archiveTempPath = sourceValue
  }

  const supabase = await createClient()

  const { data: project, error: insertError } = await supabase
    .from('projects')
    .insert({
      id,
      name,
      description,
      repository_url: repositoryUrl,
      repository_branch: repositoryBranch,
      source_kind: sourceKind,
      archive_temp_path: archiveTempPath,
    })
    .select()
    .single()

  if (insertError) {
    console.error('[projects.post] failed to create project', insertError)
    return NextResponse.json({ error: 'Failed to create project.' }, { status: 500 })
  }

  const { data: analysis, error: analysisError } = await supabase
    .from('project_analyses')
    .insert({
      project_id: id,
      status: 'pending',
      prompt,
      source_kind: sourceKind,
      source_value: sourceValue,
      archive_temp_path: archiveTempPath,
    })
    .select()
    .single()

  if (analysisError) {
    console.error('[projects.post] failed to enqueue initial analysis', analysisError)
    return NextResponse.json({ project, error: 'Project created, but analysis could not be queued.' }, { status: 500 })
  }

  return NextResponse.json({ project, analysis })
}

