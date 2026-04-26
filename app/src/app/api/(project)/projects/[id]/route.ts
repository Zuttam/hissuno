import { NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { updateGitHubCodebase, cleanupRepository } from '@/lib/codebase'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { projects, projectMembers, codebases } from '@/lib/db/schema/app'
import { eq, and, ilike, ne } from 'drizzle-orm'

export const runtime = 'nodejs'

type RouteParams = { id: string }

type RouteContext = {
  params: Promise<RouteParams>
}

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[projects.id.get] Database must be configured to load project', id)
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, id)

    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    })

    if (!project) {
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    return NextResponse.json({ project })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[projects.id.get] unexpected error', error)
    return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params

  const payload = await request.json().catch(() => null)

  if (!payload || typeof payload !== 'object') {
    return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 })
  }

  const projectUpdates: Record<string, unknown> = {}
  const sourceCodeUpdates: { 
    repositoryUrl?: string
    repositoryBranch?: string
  } = {}

  if (typeof payload.name === 'string') {
    const trimmed = payload.name.trim()
    if (trimmed.length === 0) {
      return NextResponse.json({ error: 'Name cannot be empty.' }, { status: 400 })
    }
    projectUpdates.name = trimmed
  }
  if (typeof payload.description === 'string') {
    const trimmed = payload.description.trim()
    projectUpdates.description = trimmed.length > 0 ? trimmed : null
  }

  // Note: allowed_origins and token_required are now in widget_integrations
  // Use PATCH /api/integrations/widget to update them

  // Handle source code updates (for GitHub repos)
  if (typeof payload.repositoryUrl === 'string') {
    sourceCodeUpdates.repositoryUrl = payload.repositoryUrl.trim()
  }
  if (typeof payload.repositoryBranch === 'string') {
    sourceCodeUpdates.repositoryBranch = payload.repositoryBranch.trim()
  }
  const hasProjectUpdates = Object.keys(projectUpdates).length > 0
  const hasSourceCodeUpdates = Object.keys(sourceCodeUpdates).length > 0

  if (!hasProjectUpdates && !hasSourceCodeUpdates) {
    return NextResponse.json({ error: 'No supported fields provided.' }, { status: 400 })
  }

  if (!isDatabaseConfigured()) {
    console.error('[projects.id.patch] Database must be configured to update project', id)
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, id, { requiredRole: 'owner' })

    // Get the current project
    const currentProject = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    })

    if (!currentProject) {
      console.error('[projects.id.patch] failed to fetch project', id)
      return NextResponse.json({ error: 'Project not found.' }, { status: 404 })
    }

    // Check for duplicate project name (case-insensitive) across user's projects
    if (projectUpdates.name) {
      const duplicates = await db
        .select({ id: projects.id })
        .from(projectMembers)
        .innerJoin(projects, eq(projectMembers.project_id, projects.id))
        .where(
          and(
            eq(projectMembers.user_id, identity.type === 'user' ? identity.userId : identity.createdByUserId),
            eq(projectMembers.status, 'active'),
            ilike(projects.name, projectUpdates.name as string),
            ne(projects.id, id)
          )
        )
        .limit(1)

      if (duplicates.length > 0) {
        return NextResponse.json({ error: `You already have a project named "${projectUpdates.name}". Please choose a different name.` }, { status: 409 })
      }
    }

    if (hasSourceCodeUpdates) {
      const [sourceCode] = await db
        .select()
        .from(codebases)
        .where(eq(codebases.project_id, id))
        .limit(1)

      if (sourceCode) {
        const { repositoryUrl, repositoryBranch } = sourceCodeUpdates

        if ((repositoryUrl || repositoryBranch) && sourceCode.kind === 'github') {
          await updateGitHubCodebase(sourceCode.id, { repositoryUrl, repositoryBranch })
        }
      }
    }

    // Update project if needed
    if (hasProjectUpdates) {
      await db
        .update(projects)
        .set(projectUpdates)
        .where(eq(projects.id, id))
    }

    // Fetch the updated project
    const updatedProject = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    })

    if (!updatedProject) {
      console.error('[projects.id.patch] failed to fetch updated project', id)
      return NextResponse.json({ error: 'Failed to update project.' }, { status: 500 })
    }

    return NextResponse.json({ project: updatedProject })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[projects.id.patch] unexpected error', error)
    return NextResponse.json({ error: 'Failed to update project.' }, { status: 500 })
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const { id } = await context.params

  if (!isDatabaseConfigured()) {
    console.error('[projects.id.delete] Database must be configured to delete project', id)
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, id, { requiredRole: 'owner' })

    const codebaseRows = await db
      .select({ branch: codebases.repository_branch })
      .from(codebases)
      .where(eq(codebases.project_id, id))

    await db.delete(projects).where(eq(projects.id, id))

    await Promise.all(
      codebaseRows
        .filter((row) => row.branch)
        .map((row) => cleanupRepository(id, row.branch!).catch(() => {})),
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    console.error('[projects.id.delete] unexpected error', error)
    return NextResponse.json({ error: 'Failed to delete project.' }, { status: 500 })
  }
}
