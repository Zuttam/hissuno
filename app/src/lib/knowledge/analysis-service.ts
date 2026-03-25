/**
 * Compilation Service
 * Shared logic for triggering and managing package compilation and source analysis workflows
 *
 * Note: Codebase sync is now handled internally by the workflow via
 * prepare-codebase and cleanup-codebase steps. This service just validates
 * and triggers the workflow.
 */

import { db } from '@/lib/db'
import { projects, knowledgeSources, sourceCodes, compilationRuns } from '@/lib/db/schema/app'
import { eq, and, inArray, desc } from 'drizzle-orm'
import { mastra } from '@/mastra'
import type { KnowledgeSourceRecord } from './types'

export type TriggerSourceAnalysisParams = {
  projectId: string
  sourceId: string
  userId: string
}

export type TriggerSourceAnalysisResult = {
  success: true
  runId: string
  analysisId: string
} | {
  success: false
  error: string
  statusCode: number
}

/**
 * Triggers analysis for a single knowledge source.
 */
export async function triggerSourceAnalysis(
  params: TriggerSourceAnalysisParams
): Promise<TriggerSourceAnalysisResult> {
  const { projectId, sourceId, userId } = params

  // Fetch the source
  const [source] = await db
    .select()
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.id, sourceId),
        eq(knowledgeSources.project_id, projectId)
      )
    )
    .limit(1)

  if (!source) {
    return { success: false, error: 'Knowledge source not found.', statusCode: 404 }
  }

  // Check if already analyzing
  if (source.status === 'analyzing') {
    return { success: false, error: 'Source is already being analyzed.', statusCode: 409 }
  }

  // Set source status to analyzing
  await db
    .update(knowledgeSources)
    .set({ status: 'analyzing', error_message: null })
    .where(eq(knowledgeSources.id, sourceId))

  // Get the workflow
  const workflow = mastra.getWorkflow('sourceAnalysisWorkflow')
  if (!workflow) {
    console.error('[compilation-service] sourceAnalysisWorkflow not found')
    return { success: false, error: 'Source analysis workflow not configured.', statusCode: 500 }
  }

  // Generate a unique run ID
  const runId = `source-${sourceId}-${Date.now()}`

  // Create analysis record
  const [analysisRecord] = await db
    .insert(compilationRuns)
    .values({
      project_id: projectId,
      run_id: runId,
      status: 'running',
      started_at: new Date(),
      metadata: {
        type: 'source_analysis',
        sourceId,
        sourceType: source.type,
        userId,
      },
    })
    .returning()

  if (!analysisRecord) {
    console.error('[compilation-service] Failed to create analysis record')
    return { success: false, error: 'Failed to start analysis.', statusCode: 500 }
  }

  console.log('[compilation-service] Created source analysis record:', analysisRecord.id)

  return {
    success: true,
    runId,
    analysisId: analysisRecord.id,
  }
}

/**
 * Triggers analysis for multiple sources in the background (fire-and-forget).
 * Used by Notion sync to process sources through the analysis workflow.
 * No user context required.
 */
export async function triggerSourceAnalysisBatch(
  projectId: string,
  sourceIds: string[]
): Promise<void> {
  if (sourceIds.length === 0) return

  const workflow = mastra.getWorkflow('sourceAnalysisWorkflow')
  if (!workflow) {
    console.error('[analysis-service] sourceAnalysisWorkflow not found for batch trigger')
    return
  }

  // Fetch only the columns needed for workflow input
  const sources = await db
    .select({
      id: knowledgeSources.id,
      type: knowledgeSources.type,
      url: knowledgeSources.url,
      storage_path: knowledgeSources.storage_path,
      content: knowledgeSources.content,
      analysis_scope: knowledgeSources.analysis_scope,
      notion_page_id: knowledgeSources.notion_page_id,
      origin: knowledgeSources.origin,
      name: knowledgeSources.name,
    })
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.project_id, projectId),
        inArray(knowledgeSources.id, sourceIds)
      )
    )

  console.log(`[analysis-service] Triggering batch analysis for ${sources.length} sources`)

  // Process each source sequentially (to avoid overwhelming the LLM)
  for (const source of sources) {
    try {
      // Set status to analyzing
      await db
        .update(knowledgeSources)
        .set({ status: 'analyzing', error_message: null })
        .where(eq(knowledgeSources.id, source.id))

      const runId = `batch-${source.id}-${Date.now()}`
      const run = await workflow.createRunAsync({ runId })

      const input = {
        projectId,
        sourceId: source.id,
        sourceType: source.type as 'website' | 'docs_portal' | 'uploaded_doc' | 'raw_text' | 'codebase' | 'notion',
        url: source.url,
        storagePath: source.storage_path,
        content: source.content,
        analysisScope: source.analysis_scope ?? null,
        notionPageId: source.notion_page_id ?? null,
        origin: source.origin ?? null,
        sourceName: source.name ?? null,
      }

      // Run the workflow and consume the stream to completion
      const stream = run.stream({ inputData: input })
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      for await (const _event of stream.fullStream) {
        // Consume events to drive workflow to completion
      }

      console.log(`[analysis-service] Completed analysis for source ${source.id}`)
    } catch (error) {
      console.error(`[analysis-service] Failed analysis for source ${source.id}:`, error)
      // Mark as failed and continue with next source
      try {
        await db
          .update(knowledgeSources)
          .set({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Batch analysis failed',
          })
          .where(eq(knowledgeSources.id, source.id))
      } catch {
        // Best effort
      }
    }
  }
}

export type TriggerAnalysisParams = {
  projectId: string
  userId: string
  /** Package ID to associate the compilation with */
  packageId?: string
  /** Specific source IDs to analyze (if not provided, uses all enabled sources) */
  sourceIds?: string[]
}

export type TriggerAnalysisResult = {
  success: true
  runId: string
  analysisId: string
  sourceCount: number
  hasCodebase: boolean
} | {
  success: false
  error: string
  /** HTTP status code suggestion */
  statusCode: number
  /** If analysis is already running */
  runId?: string
  analysisId?: string
}

/**
 * Triggers package compilation for a project.
 * This function can be called from multiple places (API routes, other services).
 *
 * It will:
 * 1. Check if compilation is already running
 * 2. Fetch all knowledge sources
 * 3. Create a compilation run record
 * 4. The SSE stream route will execute the actual workflow
 *
 * Note: Codebase sync is handled internally by the workflow via prepare-codebase
 * and cleanup-codebase steps. No cleanup needed from caller.
 */
export async function triggerPackageCompilation(
  params: TriggerAnalysisParams
): Promise<TriggerAnalysisResult> {
  const { projectId, userId, packageId, sourceIds } = params

  // Fetch project
  const [project] = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId))
    .limit(1)

  if (!project) {
    console.error('[compilation-service] failed to load project', projectId)
    return { success: false, error: 'Project not found.', statusCode: 404 }
  }

  // Check if a package compilation is already running for this project
  const runningAnalyses = await db
    .select()
    .from(compilationRuns)
    .where(
      and(
        eq(compilationRuns.project_id, projectId),
        eq(compilationRuns.status, 'running')
      )
    )
    .orderBy(desc(compilationRuns.started_at))

  // Only block on package compilation runs, not source-level analyses
  const runningPackageCompilation = runningAnalyses.find((r) => {
    const meta = r.metadata as Record<string, unknown> | null
    // Source analyses have type: 'source_analysis' - skip them
    return meta?.type !== 'source_analysis'
  })

  if (runningPackageCompilation) {
    // If analysis has been running for >5 min, auto-cancel it (likely stuck)
    const startedAt = runningPackageCompilation.started_at
    if (startedAt && Date.now() - startedAt.getTime() > 5 * 60 * 1000) {
      console.log('[compilation-service] Auto-cancelling stale analysis:', runningPackageCompilation.id)
      await db
        .update(compilationRuns)
        .set({ status: 'cancelled', completed_at: new Date() })
        .where(eq(compilationRuns.id, runningPackageCompilation.id))
      // Reset any 'analyzing' sources
      await db
        .update(knowledgeSources)
        .set({ status: 'pending' })
        .where(
          and(
            eq(knowledgeSources.project_id, projectId),
            eq(knowledgeSources.status, 'analyzing')
          )
        )
      // Continue with new analysis...
    } else {
      return {
        success: false,
        error: 'Analysis is already in progress. Cancel it first to start a new one.',
        statusCode: 409,
        runId: runningPackageCompilation.run_id,
        analysisId: runningPackageCompilation.id,
      }
    }
  }

  // Fetch knowledge sources for the project
  // If sourceIds provided, only fetch those specific sources
  let sourcesQuery = db
    .select()
    .from(knowledgeSources)
    .where(eq(knowledgeSources.project_id, projectId))

  let allSourceRows: (typeof knowledgeSources.$inferSelect)[]
  if (sourceIds && sourceIds.length > 0) {
    allSourceRows = await db
      .select()
      .from(knowledgeSources)
      .where(
        and(
          eq(knowledgeSources.project_id, projectId),
          inArray(knowledgeSources.id, sourceIds)
        )
      )
  } else {
    allSourceRows = await sourcesQuery
  }

  // Cast to KnowledgeSourceRecord (the types are compatible)
  const allSources = allSourceRows as unknown as KnowledgeSourceRecord[]

  // Filter to only enabled sources (when sourceIds not specified) or use all fetched (when sourceIds specified)
  const enabledSources = sourceIds
    ? allSources // When sourceIds specified, use all fetched sources regardless of enabled flag
    : allSources.filter((s) => s.enabled !== false)

  // Find the codebase source (if any and enabled)
  const codebaseSource = enabledSources.find((s) => s.type === 'codebase')

  // Get source_code data if codebase source exists
  let sourceCode: { id: string; kind: string | null; repository_url: string | null; repository_branch: string | null } | null = null
  if (codebaseSource?.source_code_id) {
    const [sc] = await db
      .select({
        id: sourceCodes.id,
        kind: sourceCodes.kind,
        repository_url: sourceCodes.repository_url,
        repository_branch: sourceCodes.repository_branch,
      })
      .from(sourceCodes)
      .where(eq(sourceCodes.id, codebaseSource.source_code_id))
      .limit(1)
    sourceCode = sc ?? null
  }

  // Check if codebase source has GitHub source code configured
  const hasCodebase = Boolean(
    codebaseSource &&
    sourceCode?.kind === 'github' &&
    sourceCode?.repository_url &&
    sourceCode?.repository_branch
  )

  // Filter out codebase from other sources for the count
  const nonCodebaseSources = enabledSources.filter((s) => s.type !== 'codebase')
  const hasOtherSources = nonCodebaseSources.length > 0

  if (!hasCodebase && !hasOtherSources) {
    return {
      success: false,
      error: 'No enabled knowledge sources to analyze. Enable sources or add new ones first.',
      statusCode: 400,
    }
  }

  const branch = sourceCode?.repository_branch ?? null
  const analysisScope = codebaseSource?.analysis_scope ?? null

  // Update enabled sources to 'analyzing' status
  if (enabledSources.length > 0) {
    const enabledSourceIds = enabledSources.map((s) => s.id)
    await db
      .update(knowledgeSources)
      .set({ status: 'analyzing', error_message: null })
      .where(inArray(knowledgeSources.id, enabledSourceIds))
  }

  // Get the workflow
  const workflow = mastra.getWorkflow('packageCompilationWorkflow')

  if (!workflow) {
    console.error('[compilation-service] workflow not found')
    return { success: false, error: 'Compilation workflow not configured.', statusCode: 500 }
  }

  // Generate a unique run ID
  const runId = `knowledge-${projectId}-${Date.now()}`

  // Prepare workflow input - only include enabled sources
  // Note: Codebase is synced internally by prepare-codebase step
  const workflowInput = {
    projectId,
    packageId: packageId ?? null,
    analysisId: '', // Will be set after record creation
    analysisScope,
    sources: enabledSources.map((s) => ({
      id: s.id,
      type: s.type,
      url: s.url,
      storagePath: s.storage_path,
      content: s.content,
      analysisScope: s.analysis_scope,
      enabled: s.enabled,
    })),
  }

  // Create compilation run record
  const [analysisRecord] = await db
    .insert(compilationRuns)
    .values({
      project_id: projectId,
      run_id: runId,
      status: 'running',
      started_at: new Date(),
      metadata: {
        sourceCount: enabledSources.length,
        hasCodebase,
        sourceIds: enabledSources.map((s) => s.id),
        branch: branch,
        packageId: packageId ?? null,
        workflowInput: {
          ...workflowInput,
          analysisId: '', // Placeholder - will be updated below
        },
      },
    })
    .returning()

  if (!analysisRecord) {
    console.error('[compilation-service] Failed to create compilation run record')
    return { success: false, error: 'Failed to start compilation.', statusCode: 500 }
  }

  // Update the workflow input with the actual analysisId
  await db
    .update(compilationRuns)
    .set({
      metadata: {
        ...(analysisRecord.metadata as Record<string, unknown>),
        workflowInput: {
          ...workflowInput,
          analysisId: analysisRecord.id,
        },
      },
    })
    .where(eq(compilationRuns.id, analysisRecord.id))

  console.log('[compilation-service] Created compilation run record:', analysisRecord.id)

  return {
    success: true,
    runId,
    analysisId: analysisRecord.id,
    sourceCount: enabledSources.length,
    hasCodebase,
  }
}
