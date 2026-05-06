/**
 * Automation Skill State Queries (Drizzle)
 *
 * Durable per-(project, skill) key/value state that survives run pruning.
 * Skill scripts persist cursors, last-synced IDs, and other resumable state
 * here via the hissuno CLI (`hissuno automations state get/set`). The shape
 * of `state` is opaque to core — each skill defines its own schema.
 */

import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { automationSkillState } from '@/lib/db/schema/app'

export type AutomationSkillStateRow = typeof automationSkillState.$inferSelect

export async function getSkillState<T extends Record<string, unknown> = Record<string, unknown>>(
  projectId: string,
  skillId: string,
): Promise<T | null> {
  const row = await db.query.automationSkillState.findFirst({
    where: and(
      eq(automationSkillState.project_id, projectId),
      eq(automationSkillState.skill_id, skillId),
    ),
  })
  return (row?.state as T | undefined) ?? null
}

export async function setSkillState<T extends Record<string, unknown> = Record<string, unknown>>(
  projectId: string,
  skillId: string,
  state: T,
): Promise<AutomationSkillStateRow> {
  const [row] = await db
    .insert(automationSkillState)
    .values({
      project_id: projectId,
      skill_id: skillId,
      state,
    })
    .onConflictDoUpdate({
      target: [automationSkillState.project_id, automationSkillState.skill_id],
      set: {
        state,
        updated_at: new Date(),
      },
    })
    .returning()
  if (!row) throw new Error('Failed to upsert automation_skill_state')
  return row
}

export async function deleteSkillState(
  projectId: string,
  skillId: string,
): Promise<void> {
  await db
    .delete(automationSkillState)
    .where(
      and(
        eq(automationSkillState.project_id, projectId),
        eq(automationSkillState.skill_id, skillId),
      ),
    )
}
