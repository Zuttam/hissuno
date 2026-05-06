/**
 * GET /api/automations?projectId=...
 * Lists bundled + custom automation skills available to the project, each
 * annotated with the per-project enabled state and a summary of the last
 * run (status + timestamp + run id) for fast catalog rendering.
 */

import { NextRequest, NextResponse } from 'next/server'
import { and, desc, eq, inArray } from 'drizzle-orm'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { listSkillsForProject } from '@/lib/automations/dispatch'
import { listSkillSettings } from '@/lib/db/queries/project-skill-settings'
import { db } from '@/lib/db'
import { automationRuns } from '@/lib/db/schema/app'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const all = await listSkillsForProject(projectId)

    const skillIds = all.map((s) => s.id)
    const [settings, latestRunRows] = await Promise.all([
      listSkillSettings(projectId),
      skillIds.length > 0
        ? db
            .select({
              id: automationRuns.id,
              skill_id: automationRuns.skill_id,
              status: automationRuns.status,
              created_at: automationRuns.created_at,
              completed_at: automationRuns.completed_at,
            })
            .from(automationRuns)
            .where(
              and(
                eq(automationRuns.project_id, projectId),
                inArray(automationRuns.skill_id, skillIds),
              ),
            )
            .orderBy(desc(automationRuns.created_at))
        : Promise.resolve([]),
    ])

    const enabledBySkill = new Map(settings.map((s) => [s.skill_id, s.enabled]))
    const latestBySkill = new Map<string, (typeof latestRunRows)[number]>()
    for (const row of latestRunRows) {
      if (!latestBySkill.has(row.skill_id)) latestBySkill.set(row.skill_id, row)
    }

    const skills = all.map((s) => {
      const latest = latestBySkill.get(s.id)
      return {
        id: s.id,
        source: s.source,
        name: s.frontmatter.name,
        description: s.frontmatter.description,
        version: s.frontmatter.version ?? null,
        triggers: s.frontmatter.triggers ?? null,
        capabilities: s.frontmatter.capabilities ?? null,
        input: s.frontmatter.input ?? null,
        enabled: enabledBySkill.get(s.id) ?? true,
        lastRun: latest
          ? {
              runId: latest.id,
              status: latest.status,
              createdAt: latest.created_at.toISOString(),
              completedAt: latest.completed_at?.toISOString() ?? null,
            }
          : null,
      }
    })

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
