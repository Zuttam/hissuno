import { promises as fs } from 'fs'
import path from 'path'
import { NextResponse } from 'next/server'
import type { AnalyzerResponse } from '@/types/analyzer'
import { analyzeFromPath, analyzeFromZip } from '@/lib/analyzer'
import { persistProjectArchive } from '@/lib/analyzer/uploads'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

type RouteContext = {
  params: { id: string }
}

export async function GET(_request: Request, { params }: RouteContext) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('project_analyses')
    .select('*')
    .eq('project_id', params.id)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('[projects.analyses.get] failed to list analyses', params.id, error)
    return NextResponse.json({ error: 'Unable to load analyses.' }, { status: 500 })
  }

  return NextResponse.json({ analyses: data ?? [] })
}

export async function POST(request: Request, { params }: RouteContext) {
  const supabase = await createClient()

  const { data: project, error: projectError } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .single()

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  }

  const formData = await request.formData()
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

  let sourceKind: 'path' | 'upload'
  let archiveTempPath: string
  const projectUpdates: Record<string, unknown> = {}

  if (hasUpload) {
    const persisted = await persistProjectArchive(params.id, upload as File)
    archiveTempPath = persisted.path
    sourceKind = 'upload'
    projectUpdates.archive_temp_path = archiveTempPath
    projectUpdates.source_kind = sourceKind
  } else if (hasPath) {
    archiveTempPath = pathValue as string
    sourceKind = 'path'
    projectUpdates.archive_temp_path = archiveTempPath
    projectUpdates.source_kind = sourceKind
  } else {
    if (!project.archive_temp_path || !project.source_kind) {
      return NextResponse.json(
        { error: 'Project does not have a stored source. Provide a path or upload a project archive.' },
        { status: 400 }
      )
    }
    archiveTempPath = project.archive_temp_path
    sourceKind = project.source_kind
  }

  if (Object.keys(projectUpdates).length > 0) {
    const { error: updateError } = await supabase
      .from('projects')
      .update(projectUpdates)
      .eq('id', params.id)

    if (updateError) {
      console.error('[projects.analyses.post] failed to update project metadata', params.id, updateError)
      return NextResponse.json({ error: 'Failed to update project source.' }, { status: 500 })
    }
  }

  const startedAt = new Date().toISOString()
  const { data: analysisRecord, error: insertError } = await supabase
    .from('project_analyses')
    .insert({
      project_id: params.id,
      status: 'running',
      prompt,
      source_kind: sourceKind,
      source_value: archiveTempPath,
      archive_temp_path: archiveTempPath,
      started_at: startedAt,
    })
    .select()
    .single()

  if (insertError || !analysisRecord) {
    console.error('[projects.analyses.post] failed to create analysis record', params.id, insertError)
    return NextResponse.json({ error: 'Failed to queue analysis.' }, { status: 500 })
  }

  try {
    let response: AnalyzerResponse
    if (sourceKind === 'path') {
      response = await analyzeFromPath(archiveTempPath, prompt ?? undefined)
    } else {
      const buffer = await fs.readFile(archiveTempPath)
      response = await analyzeFromZip(buffer, path.basename(archiveTempPath), prompt ?? undefined)
    }

    const summary = buildAnalysisSummary(response)
    const completedAt = new Date().toISOString()

    const { data: updatedAnalysis, error: updateError } = await supabase
      .from('project_analyses')
      .update({
        status: 'completed',
        summary,
        result: response,
        completed_at: completedAt,
      })
      .eq('id', analysisRecord.id)
      .select()
      .single()

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({ analysis: updatedAnalysis })
  } catch (error) {
    console.error('[projects.analyses.post] analysis failed', params.id, error)
    const completedAt = new Date().toISOString()
    const message = error instanceof Error ? error.message : 'Unknown error'

    await supabase
      .from('project_analyses')
      .update({
        status: 'failed',
        error_message: message,
        completed_at: completedAt,
      })
      .eq('id', analysisRecord.id)

    return NextResponse.json({ error: 'Analysis failed to complete.' }, { status: 500 })
  }
}

function buildAnalysisSummary(response: AnalyzerResponse) {
  const { result } = response
  return {
    stats: result.stats,
    tokens: result.designSystem.tokens.slice(0, 5).map((token) => ({
      name: token.name,
      value: token.value,
    })),
    components: result.designSystem.components.slice(0, 5).map((component) => ({
      name: component.name,
      filePath: component.filePath,
    })),
    endpoints: result.apiSurface.endpoints.slice(0, 5).map((endpoint) => ({
      method: endpoint.method,
      path: endpoint.path,
    })),
    warnings: result.warnings.slice(0, 5).map((warning) => ({
      code: warning.code,
      message: warning.message,
    })),
    generatedAt: response.requestedAt,
  }
}

