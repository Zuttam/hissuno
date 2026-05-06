/**
 * GET /api/cron/automations
 *
 * Sweeper that fires scheduled automation runs. For each project × bundled
 * skill, resolves the effective triggers (project override if any, else
 * SKILL.md frontmatter), and dispatches a run if the skill is enabled, has a
 * scheduled cron, and we haven't already fired for the most recent window.
 *
 * Protected by CRON_SECRET (same scheme as the rest of /api/cron/*).
 */

import { NextResponse } from 'next/server'
import { parseExpression } from 'cron-parser'
import { isDatabaseConfigured } from '@/lib/db/config'
import { db } from '@/lib/db'
import { projects } from '@/lib/db/schema/app'
import { listBundledSkills } from '@/lib/automations/skills'
import { dispatchAutomationRun } from '@/lib/automations/dispatch'
import { getLatestRunByTrigger } from '@/lib/db/queries/automation-runs'
import { getEffectiveSkillSettings } from '@/lib/db/queries/project-skill-settings'

export const runtime = 'nodejs'
export const maxDuration = 60

type DispatchOutcome =
  | { project: string; skill: string; status: 'fired'; runId: string }
  | { project: string; skill: string; status: 'skipped'; reason: string }
  | { project: string; skill: string; status: 'error'; reason: string }

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret) {
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
  }

  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  const now = new Date()
  const allBundled = listBundledSkills()
  if (allBundled.length === 0) {
    return NextResponse.json({ success: true, fired: 0, message: 'No bundled skills.' })
  }

  const projectRows = await db.select({ id: projects.id, name: projects.name }).from(projects)
  if (projectRows.length === 0) {
    return NextResponse.json({ success: true, fired: 0, message: 'No projects.' })
  }

  const outcomes: DispatchOutcome[] = []
  const skippedForFanOut: string[] = []

  for (const project of projectRows) {
    const settingsMap = await getEffectiveSkillSettings(
      project.id,
      allBundled.map((s) => ({ id: s.id, declaredTriggers: s.frontmatter.triggers ?? null })),
    )

    for (const skill of allBundled) {
      const settings = settingsMap.get(skill.id)
      if (settings && !settings.enabled) {
        outcomes.push({
          project: project.id,
          skill: skill.id,
          status: 'skipped',
          reason: 'Skill disabled for project',
        })
        continue
      }

      const triggers = settings?.triggers ?? skill.frontmatter.triggers ?? null
      const cron = triggers?.scheduled?.cron
      if (!cron) continue

      // Skills with a manual.entity requirement need fan-out (one run per
      // qualifying entity in the project). Phase 5 ships the simple "no
      // entity required" path only — gate the rest off so we don't dispatch
      // broken runs.
      if (triggers?.manual?.entity) {
        if (!skippedForFanOut.includes(skill.id)) skippedForFanOut.push(skill.id)
        continue
      }

      let prevFireAt: Date
      try {
        const interval = parseExpression(cron, { currentDate: now })
        prevFireAt = interval.prev().toDate()
      } catch (err) {
        outcomes.push({
          project: project.id,
          skill: skill.id,
          status: 'error',
          reason: `Invalid cron expression "${cron}": ${(err as Error).message}`,
        })
        continue
      }

      const latest = await getLatestRunByTrigger({
        projectId: project.id,
        skillId: skill.id,
        triggerType: 'scheduled',
      })

      if (latest && latest.created_at >= prevFireAt) {
        outcomes.push({
          project: project.id,
          skill: skill.id,
          status: 'skipped',
          reason: `Already fired at ${latest.created_at.toISOString()} (window starts ${prevFireAt.toISOString()})`,
        })
        continue
      }

      try {
        const { run } = await dispatchAutomationRun({
          projectId: project.id,
          projectName: project.name,
          skillId: skill.id,
          trigger: { type: 'scheduled' },
        })
        outcomes.push({
          project: project.id,
          skill: skill.id,
          status: 'fired',
          runId: run.id,
        })
      } catch (err) {
        outcomes.push({
          project: project.id,
          skill: skill.id,
          status: 'error',
          reason: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    }
  }

  const fired = outcomes.filter((o) => o.status === 'fired').length

  return NextResponse.json({
    success: true,
    fired,
    skippedForFanOut,
    outcomes,
  })
}
