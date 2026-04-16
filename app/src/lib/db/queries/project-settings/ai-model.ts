/**
 * AI Model Settings Queries (Drizzle)
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectSettings } from '@/lib/db/schema/app'
import type { AIModelSettings, AIModelSettingsInput } from './types'
import { DEFAULT_AI_MODEL_SETTINGS } from './types'

/**
 * Gets AI model settings for a project.
 */
export async function getAIModelSettings(projectId: string): Promise<AIModelSettings> {
  try {
    const row = await db.query.projectSettings.findFirst({
      where: eq(projectSettings.project_id, projectId),
      columns: {
        ai_model: true,
        ai_model_small: true,
      },
    })

    if (!row) {
      return DEFAULT_AI_MODEL_SETTINGS
    }

    return {
      ai_model: row.ai_model ?? null,
      ai_model_small: row.ai_model_small ?? null,
    }
  } catch (error) {
    console.error('[project-settings.ai-model] unexpected error', projectId, error)
    throw error
  }
}

/**
 * Gets AI model settings with graceful fallback to defaults on error.
 * Used in workflow context and contexts without user auth.
 *
 * Results are cached for 30s per project to avoid redundant queries
 * when multiple workflow steps resolve models for the same project.
 */
const settingsCache = new Map<string, { data: AIModelSettings; expiry: number }>()
const CACHE_TTL_MS = 30_000

export async function getAIModelSettingsAdmin(projectId: string): Promise<AIModelSettings> {
  const cached = settingsCache.get(projectId)
  if (cached && cached.expiry > Date.now()) return cached.data

  try {
    const data = await getAIModelSettings(projectId)
    settingsCache.set(projectId, { data, expiry: Date.now() + CACHE_TTL_MS })
    return data
  } catch (error) {
    console.error('[project-settings.ai-model] unexpected error (admin)', projectId, error)
    return DEFAULT_AI_MODEL_SETTINGS
  }
}

/**
 * Updates AI model settings for a project.
 */
export async function updateAIModelSettings(
  projectId: string,
  settings: AIModelSettingsInput,
): Promise<AIModelSettings> {
  try {
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date(),
    }

    if (settings.ai_model !== undefined) {
      updatePayload.ai_model = settings.ai_model || null
    }
    if (settings.ai_model_small !== undefined) {
      updatePayload.ai_model_small = settings.ai_model_small || null
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
        ai_model: projectSettings.ai_model,
        ai_model_small: projectSettings.ai_model_small,
      })

    if (!row) {
      throw new Error('Unable to update AI model settings.')
    }

    // Invalidate cache so workflows pick up the new settings
    settingsCache.delete(projectId)

    return {
      ai_model: row.ai_model ?? null,
      ai_model_small: row.ai_model_small ?? null,
    }
  } catch (error) {
    console.error('[project-settings.ai-model] unexpected error updating', projectId, error)
    throw error
  }
}
