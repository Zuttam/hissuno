/**
 * GET /api/cron/automations
 *
 * Sweeper that fires scheduled automation runs. For each project × bundled
 * skill where the skill declares `triggers.scheduled.cron`, computes the
 * cron's most recent fire time and dispatches a run if we haven't already
 * fired for that window.
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

  const scheduled = listBundledSkills().filter(
    (s) => typeof s.frontmatter.triggers?.scheduled?.cron === 'string',
  )
  if (scheduled.length === 0) {
    return NextResponse.json({ success: true, fired: 0, message: 'No scheduled skills.' })
  }

  // Skills with a manual.entity requirement need fan-out (one run per
  // qualifying entity in the project). Phase 5 ships the simple "no entity
  // required" path only — gate the rest off so we don't dispatch broken runs.
  const dispatchable = scheduled.filter(
    (s) => !s.frontmatter.triggers?.manual?.entity,
  )
  const skippedForFanOut = scheduled
    .filter((s) => s.frontmatter.triggers?.manual?.entity)
    .map((s) => s.id)

  const projectRows = await db.select({ id: projects.id, name: projects.name }).from(projects)
  if (projectRows.length === 0) {
    return NextResponse.json({ success: true, fired: 0, message: 'No projects.' })
  }

  const outcomes: DispatchOutcome[] = []

  for (const project of projectRows) {
    for (const skill of dispatchable) {
      const cron = skill.frontmatter.triggers!.scheduled!.cron

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
