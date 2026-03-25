/**
 * Shared Codebase Preparation Logic
 *
 * Provides reusable functions for acquiring and preparing codebase access.
 * Each workflow should create its own step that calls these functions
 * with workflow-specific schemas.
 */

import { db } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { projects } from '@/lib/db/schema/app'
import { acquireCodebase, type AcquireResult } from '@/lib/knowledge/codebase/manager'

export interface PrepareCodebaseParams {
  projectId: string
  runId?: string
  logger?: {
    info: (msg: string, data?: Record<string, unknown>) => void
    warn: (msg: string, data?: Record<string, unknown>) => void
    error: (msg: string, data?: Record<string, unknown>) => void
  }
  writer?: {
    write: (data: { type: string; message: string }) => Promise<void>
  }
}

export interface PrepareCodebaseResult {
  localCodePath: string | null
  codebaseLeaseId: string
  codebaseCommitSha: string | null
}

/**
 * Prepare codebase access for a workflow
 *
 * Acquires a lease on the project's codebase, syncing if needed.
 * Returns codebase info to be merged with workflow context.
 */
export async function prepareCodebaseForWorkflow(
  params: PrepareCodebaseParams
): Promise<PrepareCodebaseResult> {
  const { projectId, runId, logger, writer } = params

  logger?.info('[prepare-codebase] Starting', { projectId, runId })
  await writer?.write({ type: 'progress', message: 'Preparing codebase access...' })

  // Use runId as leaseId - this ties the lease to the workflow run
  const leaseId = runId ?? `workflow-${projectId}-${Date.now()}`

  // Get user_id from project for acquisition
  const [project] = await db
    .select({ user_id: projects.user_id })
    .from(projects)
    .where(eq(projects.id, projectId))

  if (!project?.user_id) {
    logger?.warn('[prepare-codebase] Project not found or no user_id')
    return {
      localCodePath: null,
      codebaseLeaseId: leaseId,
      codebaseCommitSha: null,
    }
  }

  try {
    const result: AcquireResult = await acquireCodebase({
      projectId,
      userId: project.user_id,
      leaserId: leaseId,
    })

    if (result.status === 'unavailable') {
      logger?.info('[prepare-codebase] Codebase unavailable', { error: result.error })
      await writer?.write({ type: 'progress', message: result.error ?? 'Codebase unavailable' })
      return {
        localCodePath: null,
        codebaseLeaseId: result.leaseId,
        codebaseCommitSha: null,
      }
    }

    const statusMessage = result.status === 'fresh'
      ? 'Codebase synced successfully'
      : 'Using cached codebase'

    logger?.info('[prepare-codebase] Completed', {
      status: result.status,
      localPath: result.localPath,
      commitSha: result.commitSha,
    })
    await writer?.write({ type: 'progress', message: statusMessage })

    return {
      localCodePath: result.localPath,
      codebaseLeaseId: result.leaseId,
      codebaseCommitSha: result.commitSha,
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger?.error('[prepare-codebase] Error', { error: message })
    await writer?.write({ type: 'progress', message: 'Failed to prepare codebase' })

    // Return gracefully with null path - workflow can continue without codebase
    return {
      localCodePath: null,
      codebaseLeaseId: leaseId,
      codebaseCommitSha: null,
    }
  }
}
