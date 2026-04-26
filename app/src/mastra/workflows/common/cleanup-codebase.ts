/**
 * Shared Codebase Cleanup Logic
 *
 * Provides reusable functions for releasing codebase leases.
 * Each workflow should call this function at the end to cleanup.
 */

import { releaseCodebase } from '@/lib/codebase/manager'

export interface CleanupCodebaseParams {
  codebaseLeaseId: string
  /** If true, cleanup immediately instead of deferring (default: false, cleanup is deferred) */
  forceCleanup?: boolean
  logger?: {
    info: (msg: string, data?: Record<string, unknown>) => void
    warn: (msg: string, data?: Record<string, unknown>) => void
  }
  writer?: {
    write: (data: { type: string; message: string }) => Promise<void>
  }
}

/**
 * Cleanup codebase for a workflow
 *
 * Releases the codebase lease. If this was the last lease on the codebase,
 * cleanup is deferred by default to allow sequential workflows to reuse the codebase.
 * Pass forceCleanup: true to delete immediately.
 */
export async function cleanupCodebaseForWorkflow(
  params: CleanupCodebaseParams
): Promise<boolean> {
  const { codebaseLeaseId, forceCleanup, logger, writer } = params

  logger?.info('[cleanup-codebase] Starting', { leaseId: codebaseLeaseId, forceCleanup })

  try {
    await releaseCodebase(codebaseLeaseId, { forceCleanup })
    logger?.info('[cleanup-codebase] Lease released', { leaseId: codebaseLeaseId, forceCleanup })
    await writer?.write({ type: 'progress', message: 'Codebase cleanup complete' })
    return true
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    logger?.warn('[cleanup-codebase] Error releasing lease', { leaseId: codebaseLeaseId, error: message })
    // Don't fail the workflow on cleanup errors - just log and continue
    return false
  }
}
