import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createGitHubCodebase, syncGitHubCodebase } from '@/lib/codebase'
import { triggerPackageCompilation } from '@/lib/knowledge/analysis-service'
import { UnauthorizedError } from '@/lib/auth/server'
import { ForbiddenError } from '@/lib/auth/authorization'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { addProjectMember } from '@/lib/auth/project-members'
import { createProjectSetupNotifications } from '@/lib/notifications/setup-notifications'
import type { KnowledgeSourceType, KnowledgeSourceInsert } from '@/lib/knowledge/types'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { projects, projectMembers, knowledgeSources, productScopes } from '@/lib/db/schema/app'
import { eq, and, desc, inArray, ilike } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET() {
  if (!isDatabaseConfigured()) {
    console.error('[projects.get] Database must be configured to list projects')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()

    if (identity.type === 'api_key') {
      // API keys are project-scoped — only return their project
      const data = await db
        .select()
        .from(projects)
        .where(eq(projects.id, identity.projectId))
        .orderBy(desc(projects.created_at))

      return NextResponse.json({ projects: data })
    }

    // User request — scope to projects the user is a member of
    const memberRows = await db
      .select({ project_id: projectMembers.project_id })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.user_id, identity.userId),
          eq(projectMembers.status, 'active')
        )
      )

    const projectIds = memberRows.map((m) => m.project_id)
    if (projectIds.length === 0) {
      return NextResponse.json({ projects: [] })
    }

    const data = await db
      .select()
      .from(projects)
      .where(inArray(projects.id, projectIds))
      .orderBy(desc(projects.created_at))

    return NextResponse.json({ projects: data })
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

  if (!isDatabaseConfigured()) {
    console.error('[projects.post] Database must be configured to create projects')
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()

    if (identity.type !== 'user') {
      return NextResponse.json({ error: 'API keys cannot create projects.' }, { status: 403 })
    }

    // Check for duplicate project name (case-insensitive) across user's projects
    const existingProjects = await db
      .select({ id: projects.id })
      .from(projectMembers)
      .innerJoin(projects, eq(projectMembers.project_id, projects.id))
      .where(
        and(
          eq(projectMembers.user_id, identity.userId),
          eq(projectMembers.status, 'active'),
          ilike(projects.name, name)
        )
      )
      .limit(1)

    if (existingProjects.length > 0) {
      return NextResponse.json({ error: `You already have a project named "${name}". Please choose a different name.` }, { status: 409 })
    }

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

    const [createdProject] = await db
      .insert(projects)
      .values({
        id,
        name,
        description,
        user_id: identity.userId,
      })
      .returning()

    if (!createdProject) {
      console.error('[projects.post] failed to create project')
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
      try {
        await db
          .insert(knowledgeSources)
          .values(knowledgeSourcesToInsert)

        console.log('[projects.post] Created', knowledgeSourcesToInsert.length, 'knowledge source(s) for project:', id)
      } catch (sourcesError) {
        console.warn('[projects.post] Failed to create knowledge sources:', sourcesError)
        // Don't fail project creation if knowledge source creation fails
      }
    }

    // Auto-trigger analysis if not skipped and there are any knowledge sources
    const hasKnowledgeSources = knowledgeSourcesToInsert.length > 0
    if (!skipAnalysis && hasKnowledgeSources) {
      try {
        const analysisResult = await triggerPackageCompilation({
          projectId: id,
          userId: identity.userId,
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

    // Create default product scope (fire-and-forget)
    void db
      .insert(productScopes)
      .values({
        project_id: id,
        name: 'Default',
        slug: 'default',
        description: 'Unclassified knowledge, feedback, and issues',
        color: 'default',
        position: 0,
        is_default: true,
        type: 'product_area',
      })
      .then(() => {})
      .catch((scopeError) => {
        console.warn('[projects.post] Failed to create default product scope:', scopeError)
      })

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
