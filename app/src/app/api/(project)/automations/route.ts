/**
 * GET /api/automations?projectId=...
 * Lists bundled + custom automation skills available to the project.
 *
 * Each entry includes the effective `enabled` flag and `triggers` (project
 * override if set, otherwise SKILL.md frontmatter), plus `lastRun` (most
 * recent run from automationRuns) so the UI can render status and config
 * without an extra round-trip.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { listSkillsForProject } from '@/lib/automations/dispatch'
import { getLastRunPerSkill } from '@/lib/db/queries/automation-runs'
import { getEffectiveSkillSettings } from '@/lib/db/queries/project-skill-settings'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)

    const [all, lastRunMap] = await Promise.all([
      listSkillsForProject(projectId),
      getLastRunPerSkill(projectId),
    ])

    const settingsMap = await getEffectiveSkillSettings(
      projectId,
      all.map((s) => ({
        id: s.id,
        declaredTriggers: s.frontmatter.triggers ?? null,
      })),
    )

    const skills = all.map((s) => {
      const lastRun = lastRunMap.get(s.id)
      const settings = settingsMap.get(s.id)
      return {
        id: s.id,
        source: s.source,
        name: s.frontmatter.name,
        description: s.frontmatter.description,
        version: s.frontmatter.version ?? null,
        triggers: settings?.triggers ?? s.frontmatter.triggers ?? null,
        triggersOverridden: settings?.hasOverride ?? false,
        declaredTriggers: s.frontmatter.triggers ?? null,
        capabilities: s.frontmatter.capabilities ?? null,
        input: s.frontmatter.input ?? null,
        enabled: settings?.enabled ?? true,
        lastRun: lastRun
          ? {
              runId: lastRun.id,
              status: lastRun.status,
              ranAt: (lastRun.created_at ?? new Date()).toISOString(),
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
