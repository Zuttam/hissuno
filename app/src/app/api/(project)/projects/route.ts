import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { createGitHubCodebase, syncGitHubCodebase } from '@/lib/codebase'
import { fireSourceAnalysis } from '@/lib/utils/source-processing'
import { UnauthorizedError } from '@/lib/auth/server'
import { ForbiddenError } from '@/lib/auth/authorization'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { addProjectMember } from '@/lib/auth/project-members'
import { createProjectSetupNotifications } from '@/lib/notifications/setup-notifications'
import type { KnowledgeSourceType, KnowledgeSourceInsert } from '@/lib/knowledge/types'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { projects, projectMembers, knowledgeSources, productScopes, entityRelationships } from '@/lib/db/schema/app'
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

    // Create default product scope synchronously - knowledge sources need it
    const [defaultScope] = await db
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
      .returning()

    // Create GitHub codebase if provided (now its own resource, not a knowledge_source)
    if (hasGitHubSource) {
      try {
        const { codebase } = await createGitHubCodebase({
          projectId: id,
          repositoryUrl,
          repositoryBranch,
          userId: identity.userId,
          analysisScope,
        })

        // Clone runs in the background so project creation can return immediately.
        void syncGitHubCodebase({ codebaseId: codebase.id, projectId: id }).catch((err) =>
          console.warn('[projects.post] background sync failed:', err),
        )
      } catch (codebaseError) {
        console.warn('[projects.post] Failed to create codebase:', codebaseError)
      }
    }

    // Create additional knowledge sources (websites, docs, raw_text), all linked to default scope
    const knowledgeSourcesToInsert: KnowledgeSourceInsert[] = []
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
    }

    let createdKnowledgeSourceIds: string[] = []
    if (knowledgeSourcesToInsert.length > 0) {
      try {
        const inserted = await db
          .insert(knowledgeSources)
          .values(knowledgeSourcesToInsert)
          .returning({ id: knowledgeSources.id })

        createdKnowledgeSourceIds = inserted.map((r) => r.id)

        // Link each new source to the default scope via entity_relationships
        if (defaultScope && createdKnowledgeSourceIds.length > 0) {
          await db.insert(entityRelationships).values(
            createdKnowledgeSourceIds.map((sourceId) => ({
              project_id: id,
              knowledge_source_id: sourceId,
              product_scope_id: defaultScope.id,
            })),
          )
        }

        console.log('[projects.post] Created', createdKnowledgeSourceIds.length, 'knowledge source(s) for project:', id)
      } catch (sourcesError) {
        console.warn('[projects.post] Failed to create knowledge sources:', sourcesError)
      }
    }

    // Auto-trigger per-source analysis on project creation. Package
    // compilation now lives behind the `hissuno-support-wiki` automation
    // skill — invoked from the support agent's package settings, not on
    // project create.
    if (!skipAnalysis && createdKnowledgeSourceIds.length > 0) {
      try {
        for (const sourceId of createdKnowledgeSourceIds) {
          fireSourceAnalysis(sourceId, id)
        }
        console.log('[projects.post] Fired per-source analysis for project:', id, 'count:', createdKnowledgeSourceIds.length)
      } catch (analyzeError) {
        console.warn('[projects.post] Error triggering analysis:', analyzeError)
      }
    }

    // Create setup notifications (fire-and-forget)
    void createProjectSetupNotifications(identity.userId, id, {
      hasKnowledgeSources: createdKnowledgeSourceIds.length > 0,
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
