/**
 * Graph Evaluation Settings Queries (Drizzle)
 *
 * Manages graph evaluation configuration: per-strategy matching knobs and
 * creation policies. Stored as a single jsonb `config` column.
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { graphEvaluationSettings } from '@/lib/db/schema/app'
import {
  DEFAULT_GRAPH_EVAL_CONFIG,
  parseGraphEvalConfig,
  type GraphEvaluationConfig,
} from '@/mastra/workflows/graph-evaluation/config'

export type { GraphEvaluationConfig } from '@/mastra/workflows/graph-evaluation/config'
export { DEFAULT_GRAPH_EVAL_CONFIG, parseGraphEvalConfig } from '@/mastra/workflows/graph-evaluation/config'

export async function getGraphEvaluationSettings(projectId: string): Promise<GraphEvaluationConfig> {
  try {
    const row = await db.query.graphEvaluationSettings.findFirst({
      where: eq(graphEvaluationSettings.project_id, projectId),
      columns: { config: true },
    })

    if (!row) return DEFAULT_GRAPH_EVAL_CONFIG
    return parseGraphEvalConfig(row.config)
  } catch (error) {
    console.error('[graph-evaluation-settings] unexpected error', projectId, error)
    throw error
  }
}

export async function getGraphEvaluationSettingsAdmin(projectId: string): Promise<GraphEvaluationConfig> {
  try {
    return await getGraphEvaluationSettings(projectId)
  } catch (error) {
    console.error('[graph-evaluation-settings] unexpected error (admin)', projectId, error)
    return DEFAULT_GRAPH_EVAL_CONFIG
  }
}

/**
 * Upsert the full config for a project. Callers are expected to have already
 * merged any partial patch with the current config (see mergeAndValidateConfig).
 */
export async function setGraphEvaluationSettings(
  projectId: string,
  config: GraphEvaluationConfig,
): Promise<GraphEvaluationConfig> {
  try {
    const [row] = await db
      .insert(graphEvaluationSettings)
      .values({
        project_id: projectId,
        config,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: graphEvaluationSettings.project_id,
        set: { config, updated_at: new Date() },
      })
      .returning({ config: graphEvaluationSettings.config })

    if (!row) throw new Error('Unable to update graph evaluation settings.')
    return parseGraphEvalConfig(row.config)
  } catch (error) {
    console.error('[graph-evaluation-settings] unexpected error updating', projectId, error)
    throw error
  }
}
