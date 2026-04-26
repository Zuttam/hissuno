/**
 * Project skill settings queries (Drizzle).
 *
 * One row per (project, skill) — only present when the project has
 * explicitly turned a skill on or off. Default behaviour (no row) is
 * enabled. Used by the dispatcher (manual + scheduled + event triggers)
 * to gate runs and by the catalog UI to render the toggle.
 */

import { and, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectSkillSettings } from '@/lib/db/schema/app'

export type ProjectSkillSettingRow = typeof projectSkillSettings.$inferSelect

export async function isSkillEnabledForProject(
  projectId: string,
  skillId: string,
): Promise<boolean> {
  const row = await db.query.projectSkillSettings.findFirst({
    where: and(
      eq(projectSkillSettings.project_id, projectId),
      eq(projectSkillSettings.skill_id, skillId),
    ),
  })
  // No row = default (enabled).
  return row?.enabled ?? true
}

export async function listSkillSettings(projectId: string): Promise<ProjectSkillSettingRow[]> {
  return db
    .select()
    .from(projectSkillSettings)
    .where(eq(projectSkillSettings.project_id, projectId))
}

export async function setSkillEnabled(
  projectId: string,
  skillId: string,
  enabled: boolean,
): Promise<void> {
  // Postgres-flavoured upsert via Drizzle.
  await db
    .insert(projectSkillSettings)
    .values({ project_id: projectId, skill_id: skillId, enabled })
    .onConflictDoUpdate({
      target: [projectSkillSettings.project_id, projectSkillSettings.skill_id],
      set: { enabled, updated_at: new Date() },
    })
}
