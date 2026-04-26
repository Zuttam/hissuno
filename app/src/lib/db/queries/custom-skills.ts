/**
 * Custom Skills Queries (Drizzle)
 *
 * Per-project user-uploaded automation skills. The metadata row lives here;
 * the SKILL.md body lives in blob storage at `blob_path`. Reading the body
 * is a separate concern handled in `lib/automations/custom-skills.ts`.
 */

import { and, asc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { customSkills } from '@/lib/db/schema/app'

export type CustomSkillRow = typeof customSkills.$inferSelect
export type CustomSkillInsert = typeof customSkills.$inferInsert

export async function listCustomSkills(projectId: string): Promise<CustomSkillRow[]> {
  return db
    .select()
    .from(customSkills)
    .where(eq(customSkills.project_id, projectId))
    .orderBy(asc(customSkills.created_at))
}

export async function getCustomSkill(
  projectId: string,
  skillId: string,
): Promise<CustomSkillRow | null> {
  const row = await db.query.customSkills.findFirst({
    where: and(
      eq(customSkills.project_id, projectId),
      eq(customSkills.skill_id, skillId),
    ),
  })
  return row ?? null
}

export async function upsertCustomSkill(
  data: Omit<CustomSkillInsert, 'id' | 'created_at' | 'updated_at'>,
): Promise<CustomSkillRow> {
  const existing = await getCustomSkill(data.project_id, data.skill_id)
  if (existing) {
    const [row] = await db
      .update(customSkills)
      .set({
        name: data.name,
        description: data.description,
        version: data.version ?? null,
        blob_path: data.blob_path,
        frontmatter: data.frontmatter ?? {},
        updated_at: new Date(),
      })
      .where(eq(customSkills.id, existing.id))
      .returning()
    if (!row) throw new Error('Failed to update custom skill')
    return row
  }

  const [row] = await db.insert(customSkills).values(data).returning()
  if (!row) throw new Error('Failed to insert custom skill')
  return row
}

export async function deleteCustomSkill(projectId: string, skillId: string): Promise<boolean> {
  const result = await db
    .delete(customSkills)
    .where(
      and(
        eq(customSkills.project_id, projectId),
        eq(customSkills.skill_id, skillId),
      ),
    )
    .returning({ id: customSkills.id })
  return result.length > 0
}
