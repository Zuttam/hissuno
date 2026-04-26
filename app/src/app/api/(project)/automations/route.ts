/**
 * GET /api/automations?projectId=...
 * Lists bundled automation skills available to the project.
 *
 * For Phase 1 the catalog is global (all bundled skills). Per-project
 * enable/disable lands with the UI in Phase 5.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { listBundledSkills } from '@/lib/automations/skills'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const skills = listBundledSkills().map((s) => ({
      id: s.id,
      source: s.source,
      name: s.frontmatter.name,
      description: s.frontmatter.description,
      version: s.frontmatter.version ?? null,
      triggers: s.frontmatter.triggers ?? null,
      capabilities: s.frontmatter.capabilities ?? null,
      input: s.frontmatter.input ?? null,
    }))

    return NextResponse.json({ skills })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 })
    }
    console.error('[automations.list] error', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
