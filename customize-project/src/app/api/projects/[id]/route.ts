import { NextResponse } from 'next/server'
import { removeProjectTempDir } from '@/lib/analyzer/uploads'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteContext = {
  params: { id: string }
}

export async function GET(_request: Request, { params }: RouteContext) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('projects')
    .select('*, project_analyses(*)')
    .eq('id', params.id)
    .order('created_at', { referencedTable: 'project_analyses', ascending: false })
    .single()

  if (error) {
    console.error('[projects.id.get] failed to load project', params.id, error)
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  }

  return NextResponse.json({ project: data })
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const payload = await request.json().catch(() => null)

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const updates: Record<string, unknown> = {}
  if (typeof payload.name === 'string') {
    const trimmed = payload.name.trim()
    if (trimmed.length === 0) {
      return NextResponse.json({ error: 'Name cannot be empty.' }, { status: 400 })
    }
    updates.name = trimmed
  }
  if (typeof payload.description === 'string') {
    const trimmed = payload.description.trim()
    updates.description = trimmed.length > 0 ? trimmed : null
  }
  if (typeof payload.repositoryUrl === 'string') {
    const trimmed = payload.repositoryUrl.trim()
    updates.repository_url = trimmed.length > 0 ? trimmed : null
  }
  if (typeof payload.repositoryBranch === 'string') {
    const trimmed = payload.repositoryBranch.trim()
    updates.repository_branch = trimmed.length > 0 ? trimmed : null
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No supported fields provided.' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('projects')
    .update(updates)
    .eq('id', params.id)
    .select()
    .single()

  if (error) {
    console.error('[projects.id.patch] failed to update project', params.id, error)
    return NextResponse.json({ error: 'Failed to update project.' }, { status: 500 })
  }

  return NextResponse.json({ project: data })
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const supabase = await createClient()

  const { error } = await supabase.from('projects').delete().eq('id', params.id)

  if (error) {
    console.error('[projects.id.delete] failed to delete project', params.id, error)
    return NextResponse.json({ error: 'Failed to delete project.' }, { status: 500 })
  }

  await removeProjectTempDir(params.id)

  return NextResponse.json({ success: true })
}

