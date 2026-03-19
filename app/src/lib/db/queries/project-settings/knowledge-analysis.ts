/**
 * Knowledge Analysis Settings Queries (Drizzle)
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectSettings } from '@/lib/db/schema/app'
import { UnauthorizedError } from '@/lib/auth/server'
import { resolveRequestContext } from '@/lib/db/server'
import { hasProjectAccess } from '@/lib/auth/project-members'
import type { KnowledgeAnalysisSettings, KnowledgeAnalysisSettingsInput } from './types'
import { DEFAULT_KNOWLEDGE_ANALYSIS_SETTINGS } from './types'

/**
 * Gets knowledge analysis settings for a project. Requires authenticated user context.
 */
export async function getKnowledgeAnalysisSettings(projectId: string): Promise<KnowledgeAnalysisSettings> {
  try {
    const { userId } = await resolveRequestContext()

    const hasAccess = await hasProjectAccess(projectId, userId)
    if (!hasAccess) {
      throw new UnauthorizedError('You do not have access to this project.')
    }

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
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[project-settings.knowledge-analysis] unexpected error', projectId, error)
    throw error
  }
}

/**
 * Gets knowledge analysis settings using admin client.
 * Used in workflow context where there's no user auth.
 */
export async function getKnowledgeAnalysisSettingsAdmin(projectId: string): Promise<KnowledgeAnalysisSettings> {
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
    console.error('[project-settings.knowledge-analysis] unexpected error (admin)', projectId, error)
    return DEFAULT_KNOWLEDGE_ANALYSIS_SETTINGS
  }
}

/**
 * Updates knowledge analysis settings for a project. Requires authenticated user context.
 */
export async function updateKnowledgeAnalysisSettings(
  projectId: string,
  settings: KnowledgeAnalysisSettingsInput
): Promise<KnowledgeAnalysisSettings> {
  try {
    const { userId } = await resolveRequestContext()

    const hasAccess = await hasProjectAccess(projectId, userId)
    if (!hasAccess) {
      throw new UnauthorizedError('You do not have access to this project.')
    }

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
    if (error instanceof UnauthorizedError) {
      throw error
    }
    console.error('[project-settings.knowledge-analysis] unexpected error updating', projectId, error)
    throw error
  }
}
