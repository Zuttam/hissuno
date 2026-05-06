/**
 * Automation Runs Queries (Drizzle)
 *
 * Generic per-run record for skill-based automations. One row per run, lives
 * for the full lifecycle (queued -> running -> succeeded|failed|cancelled).
 *
 * Progress events are appended in-place as JSONB arrays. Same row also stores
 * the final agent output (`output`) and any structured error.
 */

import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { automationRuns } from '@/lib/db/schema/app'

export type AutomationRunRow = typeof automationRuns.$inferSelect
export type AutomationRunInsert = typeof automationRuns.$inferInsert

export type AutomationRunStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'cancelled'

export type TriggerType = 'manual' | 'scheduled' | 'event'
export type SkillSource = 'bundled' | 'custom'

export type ProgressEvent = {
  ts: string // ISO timestamp
  type: string // 'progress' | 'tool-start' | 'tool-end' | 'message' | ...
  message?: string
  data?: Record<string, unknown>
}

export type AutomationRunError = {
  code?: string
  message: string
  stack?: string
}

export type CreateAutomationRunInput = {
  projectId: string
  skillId: string
  skillVersion?: string | null
  skillSource: SkillSource
  triggerType: TriggerType
  triggerEntityType?: string | null
  triggerEntityId?: string | null
  input: Record<string, unknown>
}

export async function createAutomationRun(
  data: CreateAutomationRunInput,
): Promise<AutomationRunRow> {
  const [row] = await db
    .insert(automationRuns)
    .values({
      project_id: data.projectId,
      skill_id: data.skillId,
      skill_version: data.skillVersion ?? null,
      skill_source: data.skillSource,
      trigger_type: data.triggerType,
      trigger_entity_type: data.triggerEntityType ?? null,
      trigger_entity_id: data.triggerEntityId ?? null,
      status: 'queued',
      input: data.input,
      progress_events: [],
    })
    .returning()

  if (!row) {
    throw new Error('Failed to create automation run')
  }

  return row
}

export async function getAutomationRun(
  runId: string,
  projectId?: string,
): Promise<AutomationRunRow | null> {
  const conditions = projectId
    ? and(eq(automationRuns.id, runId), eq(automationRuns.project_id, projectId))
    : eq(automationRuns.id, runId)

  const row = await db.query.automationRuns.findFirst({ where: conditions })
  return row ?? null
}

export async function listAutomationRuns(opts: {
  projectId: string
  skillId?: string
  status?: AutomationRunStatus
  limit?: number
}): Promise<AutomationRunRow[]> {
  const conditions = [eq(automationRuns.project_id, opts.projectId)]
  if (opts.skillId) conditions.push(eq(automationRuns.skill_id, opts.skillId))
  if (opts.status) conditions.push(eq(automationRuns.status, opts.status))

  return db
    .select()
    .from(automationRuns)
    .where(and(...conditions))
    .orderBy(desc(automationRuns.created_at))
    .limit(opts.limit ?? 50)
}

export async function markAutomationRunStarted(runId: string): Promise<void> {
  await db
    .update(automationRuns)
    .set({
      status: 'running',
      started_at: new Date(),
      updated_at: new Date(),
    })
    .where(eq(automationRuns.id, runId))
}

export async function markAutomationRunSucceeded(
  runId: string,
  output: Record<string, unknown>,
): Promise<void> {
  const now = new Date()
  await db
    .update(automationRuns)
    .set({
      status: 'succeeded',
      output,
      completed_at: now,
      updated_at: now,
      duration_ms: sql`EXTRACT(EPOCH FROM (${now.toISOString()}::timestamp - started_at)) * 1000`,
    })
    .where(eq(automationRuns.id, runId))
}

export async function markAutomationRunFailed(
  runId: string,
  error: AutomationRunError,
): Promise<void> {
  const now = new Date()
  await db
    .update(automationRuns)
    .set({
      status: 'failed',
      error,
      completed_at: now,
      updated_at: now,
      duration_ms: sql`EXTRACT(EPOCH FROM (${now.toISOString()}::timestamp - started_at)) * 1000`,
    })
    .where(eq(automationRuns.id, runId))
}

export async function markAutomationRunCancelled(runId: string): Promise<void> {
  const now = new Date()
  await db
    .update(automationRuns)
    .set({
      status: 'cancelled',
      completed_at: now,
      updated_at: now,
    })
    .where(eq(automationRuns.id, runId))
}

/**
 * Returns the most recent run for each skill in this project. Used by the
 * automations list to render last-run timestamp + status per card.
 */
export async function getLastRunPerSkill(
  projectId: string,
): Promise<Map<string, AutomationRunRow>> {
  const rows = await db
    .select()
    .from(automationRuns)
    .where(eq(automationRuns.project_id, projectId))
    .orderBy(desc(automationRuns.created_at))

  const latestBySkill = new Map<string, AutomationRunRow>()
  for (const row of rows) {
    if (!latestBySkill.has(row.skill_id)) {
      latestBySkill.set(row.skill_id, row)
    }
  }
  return latestBySkill
}

/**
 * Returns the most recent run of (project, skill, triggerType) — used by the
 * cron worker to dedup scheduled fires. Returns null if there's no prior run.
 */
export async function getLatestRunByTrigger(opts: {
  projectId: string
  skillId: string
  triggerType: TriggerType
}): Promise<AutomationRunRow | null> {
  const row = await db.query.automationRuns.findFirst({
    where: and(
      eq(automationRuns.project_id, opts.projectId),
      eq(automationRuns.skill_id, opts.skillId),
      eq(automationRuns.trigger_type, opts.triggerType),
    ),
    orderBy: desc(automationRuns.created_at),
  })
  return row ?? null
}

export async function appendProgressEvent(
  runId: string,
  event: ProgressEvent,
): Promise<void> {
  await db
    .update(automationRuns)
    .set({
      // Append a single JSON object to the JSONB array column
      progress_events: sql`COALESCE(progress_events, '[]'::jsonb) || ${JSON.stringify([event])}::jsonb`,
      updated_at: new Date(),
    })
    .where(eq(automationRuns.id, runId))
}
