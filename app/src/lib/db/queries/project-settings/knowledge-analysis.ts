/**
 * Knowledge Analysis Settings Queries (Drizzle)
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectSettings } from '@/lib/db/schema/app'
import type { KnowledgeAnalysisSettings, KnowledgeAnalysisSettingsInput } from './types'
import { DEFAULT_KNOWLEDGE_ANALYSIS_SETTINGS } from './types'

/**
 * Gets knowledge analysis settings for a project.
 */
export async function getKnowledgeAnalysisSettings(projectId: string): Promise<KnowledgeAnalysisSettings> {
  try {
    const row = await db.query.projectSettings.findFirst({
      where: eq(projectSettings.project_id, projectId),
      columns: {
        knowledge_relationship_guidelines: true,
      },
    })

    if (!row) {
      return DEFAULT_KNOWLEDGE_ANALYSIS_SETTINGS
    }

    return {
      knowledge_relationship_guidelines: row.knowledge_relationship_guidelines ?? null,
    }
  } catch (error) {
    console.error('[project-settings.knowledge-analysis] unexpected error', projectId, error)
    throw error
  }
}

/**
 * Gets knowledge analysis settings with graceful fallback to defaults on error.
 * Used in workflow context and contexts without user auth.
 */
export async function getKnowledgeAnalysisSettingsAdmin(projectId: string): Promise<KnowledgeAnalysisSettings> {
  try {
    return await getKnowledgeAnalysisSettings(projectId)
  } catch (error) {
    console.error('[project-settings.knowledge-analysis] unexpected error (admin)', projectId, error)
    return DEFAULT_KNOWLEDGE_ANALYSIS_SETTINGS
  }
}

/**
 * Updates knowledge analysis settings for a project.
 */
export async function updateKnowledgeAnalysisSettings(
  projectId: string,
  settings: KnowledgeAnalysisSettingsInput
): Promise<KnowledgeAnalysisSettings> {
  try {
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date(),
    }

    if (settings.knowledge_relationship_guidelines !== undefined) {
      updatePayload.knowledge_relationship_guidelines = settings.knowledge_relationship_guidelines || null
    }

    const [row] = await db
      .insert(projectSettings)
      .values({
        project_id: projectId,
        ...updatePayload,
      })
      .onConflictDoUpdate({
        target: projectSettings.project_id,
        set: updatePayload,
      })
      .returning({
        knowledge_relationship_guidelines: projectSettings.knowledge_relationship_guidelines,
      })

    if (!row) {
      throw new Error('Unable to update knowledge analysis settings.')
    }

    return {
      knowledge_relationship_guidelines: row.knowledge_relationship_guidelines ?? null,
    }
  } catch (error) {
    console.error('[project-settings.knowledge-analysis] unexpected error updating', projectId, error)
    throw error
  }
}
