import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createGitHubCodebase, syncGitHubCodebase } from '@/lib/codebase'
import { triggerKnowledgeAnalysis } from '@/lib/knowledge/analysis-service'
import { UnauthorizedError } from '@/lib/auth/server'
import { ForbiddenError } from '@/lib/auth/authorization'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { addProjectMember } from '@/lib/auth/project-members'
import { createProjectSetupNotifications } from '@/lib/notifications/setup-notifications'
import type { Database } from '@/types/supabase'
import type { KnowledgeSourceType, KnowledgeSourceInsert } from '@/lib/knowledge/types'
import {
  createClient,
  isSupabaseConfigured,
} from '@/lib/supabase/server'

export const runtime = 'nodejs'

export async function GET() {
  if (!isSupabaseConfigured()) {
    console.error('[projects.get] Supabase must be configured to list projects')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    await requireRequestIdentity()

    const supabase = await createClient()

    const { data, error } = await supabase
      .from('projects')
      .select('*')
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
  const skipAnalysis = formData.get('skipAnalysis')?.toString() === 'true'

  // GitHub source params
  const repositoryUrl = formData.get('repositoryUrl')?.toString().trim() || null
  const repositoryBranch = formData.get('repositoryBranch')?.toString().trim() || null

  // Analysis scope (for monorepos) - stored in knowledge_sources, not source_codes
  const analysisScope = formData.get('analysisScope')?.toString().trim() || null

  // Additional knowledge sources (JSON array)
  const knowledgeSourcesJson = formData.get('knowledgeSources')?.toString()
  let additionalSources: Array<{ type: KnowledgeSourceType; url?: string; content?: string }> = []
  if (knowledgeSourcesJson) {
    try {
      additionalSources = JSON.parse(knowledgeSourcesJson)
    } catch {
      console.warn('[projects.post] Failed to parse knowledgeSources JSON')
    }
  }

  const hasGitHubSource = codebaseSource === 'github' && repositoryUrl && repositoryBranch
  const id = randomUUID()

  if (!isSupabaseConfigured()) {
    console.error('[projects.post] Supabase must be configured to create projects')
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()

    if (identity.type !== 'user') {
      return NextResponse.json({ error: 'API keys cannot create projects.' }, { status: 403 })
    }

    const supabase = await createClient()

    let codebaseId: string | null = null

    // Create GitHub codebase if provided
    if (hasGitHubSource) {
      const { codebase } = await createGitHubCodebase({
        repositoryUrl,
        repositoryBranch,
        userId: identity.userId,
      })
      codebaseId = codebase.id

      // Sync (clone) GitHub codebase immediately
      const syncResult = await syncGitHubCodebase({
        codebaseId: codebase.id,
        userId: identity.userId,
        projectId: id,
      })

      if (syncResult.status === 'error') {
        console.warn('[projects.post] GitHub clone failed, but project will still be created:', syncResult.error)
      } else {
        console.log('[projects.post] GitHub clone completed:', syncResult.status, syncResult.commitSha)
      }
    }

    const projectInsert: Database['public']['Tables']['projects']['Insert'] = {
      id,
      name,
      description,
      user_id: identity.userId,
    }

    const { data: createdProject, error: projectInsertError } = await supabase
      .from('projects')
      .insert(projectInsert)
      .select('*')
      .single()

    if (projectInsertError || !createdProject) {
      console.error('[projects.post] failed to create project', projectInsertError)
      return NextResponse.json({ error: 'Failed to create project.' }, { status: 500 })
    }

    // Add creator as owner in project_members
    await addProjectMember({
      projectId: id,
      userId: identity.userId,
      role: 'owner',
      status: 'active',
    })

    // Create knowledge sources
    const knowledgeSourcesToInsert: KnowledgeSourceInsert[] = []

    // Auto-create codebase knowledge_source if project has a codebase
    if (codebaseId) {
      knowledgeSourcesToInsert.push({
        project_id: id,
        type: 'codebase',
        source_code_id: codebaseId,
        status: 'pending',
        analysis_scope: analysisScope,
        enabled: true,
      })
    }

    // Add additional knowledge sources (websites, docs, raw_text)
    for (const source of additionalSources) {
      if (source.type === 'website' || source.type === 'docs_portal') {
        if (source.url) {
          knowledgeSourcesToInsert.push({
            project_id: id,
            type: source.type,
            url: source.url,
            status: 'pending',
            enabled: true,
          })
        }
      } else if (source.type === 'raw_text') {
        if (source.content) {
          knowledgeSourcesToInsert.push({
            project_id: id,
            type: source.type,
            content: source.content,
            status: 'pending',
            enabled: true,
          })
        }
      }
      // Note: uploaded_doc type is handled separately via file uploads
    }

    if (knowledgeSourcesToInsert.length > 0) {
      const { error: sourcesError } = await supabase
        .from('knowledge_sources')
        .insert(knowledgeSourcesToInsert)

      if (sourcesError) {
        console.warn('[projects.post] Failed to create knowledge sources:', sourcesError)
        // Don't fail project creation if knowledge source creation fails
      } else {
        console.log('[projects.post] Created', knowledgeSourcesToInsert.length, 'knowledge source(s) for project:', id)
      }
    }

    // Auto-trigger analysis if not skipped and there are any knowledge sources
    const hasKnowledgeSources = knowledgeSourcesToInsert.length > 0
    if (!skipAnalysis && hasKnowledgeSources) {
      try {
        const analysisResult = await triggerKnowledgeAnalysis({
          projectId: id,
          userId: identity.userId,
          supabase,
        })

        if (analysisResult.success) {
          console.log('[projects.post] Analysis triggered for project:', id, 'analysisId:', analysisResult.analysisId)
        } else {
          console.warn('[projects.post] Failed to trigger analysis:', analysisResult.error)
        }
      } catch (analyzeError) {
        // Don't fail project creation if analysis trigger fails
        console.warn('[projects.post] Error triggering analysis:', analyzeError)
      }
    }

    // Create setup notifications (fire-and-forget)
    void createProjectSetupNotifications(identity.userId, id, {
      hasKnowledgeSources: knowledgeSourcesToInsert.length > 0,
    }).catch((err) => console.error('[projects.post] setup notifications error:', err))

    return NextResponse.json({ project: createdProject })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }

    console.error('[projects.post] unexpected error', error)
    return NextResponse.json({ error: 'Failed to create project.' }, { status: 500 })
  }
}
