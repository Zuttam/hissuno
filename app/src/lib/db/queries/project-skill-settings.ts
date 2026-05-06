/**
 * Project Skill Settings Queries (Drizzle)
 *
 * Per-project configuration for any automation skill (bundled or custom).
 *
 * - `enabled` gates whether the skill is dispatchable at all (run UI button,
 *   cron sweeper, event dispatcher all check this).
 * - `triggers` is an OPTIONAL override of the SKILL.md frontmatter triggers.
 *   When null, the skill uses its declared triggers as-is. When set, it
 *   fully replaces them (manual / scheduled / events all live in the
 *   override). Setting `triggers: null` via PATCH clears the override.
 */

import { and, eq, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectSkillSettings } from '@/lib/db/schema/app'
import type { SkillFrontmatter } from '@/lib/automations/types'

export type ProjectSkillSettingsRow = typeof projectSkillSettings.$inferSelect

export type SkillTriggers = NonNullable<SkillFrontmatter['triggers']>

export type EffectiveSkillSettings = {
  enabled: boolean
  /** Resolved triggers — override if present, else the SKILL.md frontmatter. */
  triggers: SkillTriggers | null
  /** Whether triggers were overridden in project_skill_settings. */
  hasOverride: boolean
}

export async function listProjectSkillSettings(
  projectId: string,
): Promise<ProjectSkillSettingsRow[]> {
  return db
    .select()
    .from(projectSkillSettings)
    .where(eq(projectSkillSettings.project_id, projectId))
}

export async function getProjectSkillSetting(
  projectId: string,
  skillId: string,
): Promise<ProjectSkillSettingsRow | null> {
  const row = await db.query.projectSkillSettings.findFirst({
    where: and(
      eq(projectSkillSettings.project_id, projectId),
      eq(projectSkillSettings.skill_id, skillId),
    ),
  })
  return row ?? null
}

export async function upsertProjectSkillSetting(
  projectId: string,
  skillId: string,
  patch: { enabled?: boolean; triggers?: SkillTriggers | null },
): Promise<ProjectSkillSettingsRow> {
  const existing = await getProjectSkillSetting(projectId, skillId)
  if (existing) {
    const [row] = await db
      .update(projectSkillSettings)
      .set({
        ...(patch.enabled !== undefined ? { enabled: patch.enabled } : {}),
        ...(patch.triggers !== undefined ? { triggers: patch.triggers } : {}),
        updated_at: new Date(),
      })
      .where(eq(projectSkillSettings.id, existing.id))
      .returning()
    if (!row) throw new Error('Failed to update project_skill_settings')
    return row
  }

  const [row] = await db
    .insert(projectSkillSettings)
    .values({
      project_id: projectId,
      skill_id: skillId,
      enabled: patch.enabled ?? true,
      triggers: patch.triggers ?? null,
    })
    .returning()
  if (!row) throw new Error('Failed to insert project_skill_settings')
  return row
}

export async function deleteProjectSkillSettingsForSkillIds(
  projectId: string,
  skillIds: string[],
): Promise<void> {
  if (skillIds.length === 0) return
  await db
    .delete(projectSkillSettings)
    .where(
      and(
        eq(projectSkillSettings.project_id, projectId),
        inArray(projectSkillSettings.skill_id, skillIds),
      ),
    )
}

/**
 * Resolve effective settings for a list of skills, given their declared
 * frontmatter triggers. Single round-trip to the DB.
 */
export async function getEffectiveSkillSettings(
  projectId: string,
  skills: Array<{ id: string; declaredTriggers: SkillTriggers | null }>,
): Promise<Map<string, EffectiveSkillSettings>> {
  if (skills.length === 0) return new Map()

  const rows = await db
    .select()
    .from(projectSkillSettings)
    .where(
      and(
        eq(projectSkillSettings.project_id, projectId),
        inArray(
          projectSkillSettings.skill_id,
          skills.map((s) => s.id),
        ),
      ),
    )
  const byId = new Map(rows.map((r) => [r.skill_id, r]))

  const result = new Map<string, EffectiveSkillSettings>()
  for (const skill of skills) {
    const settings = byId.get(skill.id)
    const override = settings?.triggers as SkillTriggers | null | undefined
    result.set(skill.id, {
      enabled: settings?.enabled ?? true,
      triggers: override ?? skill.declaredTriggers ?? null,
      hasOverride: override !== null && override !== undefined,
    })
  }
  return result
}
