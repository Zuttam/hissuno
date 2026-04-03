/**
 * Graph Evaluation Settings Queries (Drizzle)
 *
 * Manages graph evaluation configuration: creation policy toggle.
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { graphEvaluationSettings } from '@/lib/db/schema/app'

export interface GraphEvaluationSettingsRecord {
  creation_policy_enabled: boolean
}

export type GraphEvaluationSettingsInput = Partial<GraphEvaluationSettingsRecord>

const DEFAULT_GRAPH_EVAL_SETTINGS: GraphEvaluationSettingsRecord = {
  creation_policy_enabled: true,
}

export async function getGraphEvaluationSettings(projectId: string): Promise<GraphEvaluationSettingsRecord> {
  try {
    const row = await db.query.graphEvaluationSettings.findFirst({
      where: eq(graphEvaluationSettings.project_id, projectId),
      columns: {
        creation_policy_enabled: true,
      },
    })

    if (!row) {
      return DEFAULT_GRAPH_EVAL_SETTINGS
    }

    return {
      creation_policy_enabled: row.creation_policy_enabled,
    }
  } catch (error) {
    console.error('[graph-evaluation-settings] unexpected error', projectId, error)
    throw error
  }
}

export async function getGraphEvaluationSettingsAdmin(projectId: string): Promise<GraphEvaluationSettingsRecord> {
  try {
    return await getGraphEvaluationSettings(projectId)
  } catch (error) {
    console.error('[graph-evaluation-settings] unexpected error (admin)', projectId, error)
    return DEFAULT_GRAPH_EVAL_SETTINGS
  }
}

export async function updateGraphEvaluationSettings(
  projectId: string,
  settings: GraphEvaluationSettingsInput
): Promise<GraphEvaluationSettingsRecord> {
  try {
    const updatePayload: Record<string, unknown> = {
      updated_at: new Date(),
    }

    if (settings.creation_policy_enabled !== undefined) {
      updatePayload.creation_policy_enabled = settings.creation_policy_enabled
    }

    const [row] = await db
      .insert(graphEvaluationSettings)
      .values({
        project_id: projectId,
        ...updatePayload,
      })
      .onConflictDoUpdate({
        target: graphEvaluationSettings.project_id,
        set: updatePayload,
      })
      .returning({
        creation_policy_enabled: graphEvaluationSettings.creation_policy_enabled,
      })

    if (!row) {
      throw new Error('Unable to update graph evaluation settings.')
    }

    return {
      creation_policy_enabled: row.creation_policy_enabled,
    }
  } catch (error) {
    console.error('[graph-evaluation-settings] unexpected error updating', projectId, error)
    throw error
  }
}
