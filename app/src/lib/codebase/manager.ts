/**
 * Codebase Manager
 *
 * Centralized lease-based access to codebases with reference counting.
 * Enables multiple workflows to share the same codebase clone and ensures
 * cleanup only happens when all leases are released.
 *
 * Features:
 * - Reference counting: Multiple workflows share the same codebase
 * - Smart sync: Only pulls if remote has newer commits
 * - TTL cleanup: Auto-cleanup after inactivity
 * - Graceful degradation: Returns null localPath if sync fails
 */

import { db } from '@/lib/db'
import { knowledgeSources, sourceCodes } from '@/lib/db/schema/app'
import { eq, and } from 'drizzle-orm'
import { getGitHubInstallationToken, getLatestCommitSha, parseGitHubRepoUrl } from '@/lib/integrations/github'
import {
  cloneRepository,
  pullRepository,
  cleanupRepository,
  repositoryExists,
  getLocalPath,
  getCurrentCommitSha,
  GitOperationError,
} from './git-operations'

// ============================================================================
// Types
// ============================================================================

export interface AcquireResult {
  /** Local filesystem path to the cloned codebase, or null if unavailable */
  localPath: string | null
  /** Unique identifier for this lease - use to release */
  leaseId: string
  /** Git commit SHA of the checked out code, or null if unavailable */
  commitSha: string | null
  /** Whether the codebase was freshly synced, from cache, or unavailable */
  status: 'fresh' | 'cached' | 'unavailable'
  /** Error message if status is 'unavailable' */
  error?: string
}

export interface CodebaseInfo {
  codebaseId: string
  branch: string
  repositoryUrl: string
  userId: string
}

interface LeaseRecord {
  leaseId: string
  projectId: string
  branch: string
  acquiredAt: Date
  ttlMinutes: number
}

interface CodebaseState {
  projectId: string
  branch: string
  localPath: string
  commitSha: string | null
  leases: Map<string, LeaseRecord>
  lastAccessedAt: Date
  /** When cleanup becomes eligible (set when leases hit 0 with deferCleanup) */
  cleanupEligibleAt: Date | null
}

// ============================================================================
// In-Memory Lease Storage
// ============================================================================

// Cache the lease manager globally to survive HMR in development
const globalForManager = globalThis as unknown as {
  codebaseLeaseManager: Map<string, CodebaseState> | undefined
  cleanupInterval: NodeJS.Timeout | undefined
}

const codebaseStates: Map<string, CodebaseState> =
  globalForManager.codebaseLeaseManager ?? new Map()

if (process.env.NODE_ENV !== 'production') {
  globalForManager.codebaseLeaseManager = codebaseStates
}

// Default TTL in minutes
const DEFAULT_TTL_MINUTES = 30

// Cleanup interval (check every 5 minutes)
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000

// Grace period before cleanup after all leases released (5 minutes)
const CLEANUP_GRACE_MS = 5 * 60 * 1000

/**
 * Generate a unique key for a codebase (projectId + branch)
 */
function getCodebaseKey(projectId: string, branch: string): string {
  return `${projectId}:${branch}`
}

/**
 * Start the background cleanup interval if not already running
 */
function ensureCleanupInterval(): void {
  if (globalForManager.cleanupInterval) return

  globalForManager.cleanupInterval = setInterval(async () => {
    await cleanupExpiredLeases()
  }, CLEANUP_INTERVAL_MS)

  // Don't keep Node.js running just for this interval
  globalForManager.cleanupInterval.unref()
}

/**
 * Cleanup codebases with expired leases
 */
async function cleanupExpiredLeases(): Promise<void> {
  const now = new Date()

  for (const [key, state] of codebaseStates.entries()) {
    // Check each lease for expiry
    for (const [leaseId, lease] of state.leases.entries()) {
      const expiresAt = new Date(lease.acquiredAt.getTime() + lease.ttlMinutes * 60 * 1000)
      if (now > expiresAt) {
        console.log(`[codebase.manager] Lease expired: ${leaseId} for ${key}`)
        state.leases.delete(leaseId)
      }
    }

    // If no leases remain, check if cleanup is eligible
    if (state.leases.size === 0) {
      // If cleanupEligibleAt is set (deferred cleanup), respect the grace period
      if (state.cleanupEligibleAt && now < state.cleanupEligibleAt) {
        console.log(`[codebase.manager] Cleanup deferred until ${state.cleanupEligibleAt.toISOString()}: ${key}`)
        continue
      }

      console.log(`[codebase.manager] No active leases, cleaning up: ${key}`)
      try {
        await cleanupRepository(state.projectId, state.branch)
        codebaseStates.delete(key)
      } catch (error) {
        console.warn(`[codebase.manager] Failed to cleanup ${key}:`, error)
      }
    }
  }
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Get codebase configuration for a project without acquiring a lease.
 * Returns null if no GitHub codebase is configured.
 */
export async function getCodebaseInfo(projectId: string): Promise<CodebaseInfo | null> {
  // Get the codebase source for this project with joined source_code
  const sources = await db
    .select({
      source_code_id: knowledgeSources.source_code_id,
    })
    .from(knowledgeSources)
    .where(
      and(
        eq(knowledgeSources.project_id, projectId),
        eq(knowledgeSources.type, 'codebase'),
        eq(knowledgeSources.enabled, true)
      )
    )
    .limit(1)

  const source = sources[0]
  if (!source?.source_code_id) {
    return null
  }

  // Fetch the source_code record
  const [sourceCode] = await db
    .select({
      id: sourceCodes.id,
      kind: sourceCodes.kind,
      repository_url: sourceCodes.repository_url,
      repository_branch: sourceCodes.repository_branch,
      user_id: sourceCodes.user_id,
    })
    .from(sourceCodes)
    .where(eq(sourceCodes.id, source.source_code_id))
    .limit(1)

  // Verify it's a GitHub source with required fields
  if (
    !sourceCode ||
    sourceCode.kind !== 'github' ||
    !sourceCode.repository_url ||
    !sourceCode.repository_branch
  ) {
    return null
  }

  return {
    codebaseId: sourceCode.id,
    branch: sourceCode.repository_branch,
    repositoryUrl: sourceCode.repository_url,
    userId: sourceCode.user_id,
  }
}

/**
 * Acquire a codebase with a lease. Syncs the codebase if needed.
 *
 * @param projectId - Project ID that owns the codebase
 * @param userId - User ID for GitHub authentication
 * @param leaserId - Unique identifier for the lease holder (typically workflow runId)
 * @param ttlMinutes - Time to live for the lease in minutes (default: 30)
 *
 * @returns AcquireResult with localPath and lease info
 */
export async function acquireCodebase(params: {
  projectId: string
  userId: string
  leaserId: string
  ttlMinutes?: number
}): Promise<AcquireResult> {
  const { projectId, userId, leaserId, ttlMinutes = DEFAULT_TTL_MINUTES } = params

  console.log(`[codebase.manager] Acquiring codebase for project ${projectId}, leaser: ${leaserId}`)

  // Ensure cleanup interval is running
  ensureCleanupInterval()

  // Get codebase configuration
  const codebaseInfo = await getCodebaseInfo(projectId)
  if (!codebaseInfo) {
    console.log(`[codebase.manager] No codebase configured for project ${projectId}`)
    return {
      localPath: null,
      leaseId: leaserId,
      commitSha: null,
      status: 'unavailable',
      error: 'No GitHub codebase configured for this project.',
    }
  }

  const { codebaseId, branch, repositoryUrl } = codebaseInfo
  const key = getCodebaseKey(projectId, branch)

  // Get GitHub token
  const ghResult = await getGitHubInstallationToken(projectId)
  if (!ghResult) {
    console.log(`[codebase.manager] No GitHub token available for project ${projectId}`)
    return {
      localPath: null,
      leaseId: leaserId,
      commitSha: null,
      status: 'unavailable',
      error: 'GitHub integration not connected for this project.',
    }
  }
  const token = ghResult.token

  // Parse repository URL
  const parsed = parseGitHubRepoUrl(repositoryUrl)
  if (!parsed) {
    return {
      localPath: null,
      leaseId: leaserId,
      commitSha: null,
      status: 'unavailable',
      error: 'Invalid repository URL.',
    }
  }

  const { owner, repo } = parsed
  const localPath = getLocalPath(projectId, branch)

  try {
    // Check existing state
    const existingState = codebaseStates.get(key)

    if (existingState) {
      // Codebase is already managed - add new lease
      const lease: LeaseRecord = {
        leaseId: leaserId,
        projectId,
        branch,
        acquiredAt: new Date(),
        ttlMinutes,
      }
      existingState.leases.set(leaserId, lease)
      existingState.lastAccessedAt = new Date()
      existingState.cleanupEligibleAt = null // Cancel any pending deferred cleanup

      console.log(`[codebase.manager] Added lease to existing codebase: ${key}, total leases: ${existingState.leases.size}`)

      // Check if we need to pull updates (compare with remote)
      const latestSha = await getLatestCommitSha(token, owner, repo, branch)
      if (existingState.commitSha !== latestSha) {
        // Pull latest changes
        console.log(`[codebase.manager] Updating codebase ${key} from ${existingState.commitSha} to ${latestSha}`)
        const pullResult = await pullRepository({
          projectId,
          branch,
          repositoryUrl,
          token,
        })
        existingState.commitSha = pullResult.commitSha

        // Update database
        await db
          .update(sourceCodes)
          .set({
            commit_sha: pullResult.commitSha,
            synced_at: new Date(),
          })
          .where(eq(sourceCodes.id, codebaseId))

        return {
          localPath,
          leaseId: leaserId,
          commitSha: pullResult.commitSha,
          status: 'fresh',
        }
      }

      return {
        localPath,
        leaseId: leaserId,
        commitSha: existingState.commitSha,
        status: 'cached',
      }
    }

    // Check if repo exists on disk but not in our state (e.g., after restart)
    const exists = await repositoryExists(projectId, branch)
    if (exists) {
      const currentSha = await getCurrentCommitSha(projectId, branch)
      const latestSha = await getLatestCommitSha(token, owner, repo, branch)

      let commitSha = currentSha
      let status: 'fresh' | 'cached' = 'cached'

      // Pull if behind
      if (currentSha !== latestSha) {
        console.log(`[codebase.manager] Existing clone needs update: ${currentSha} -> ${latestSha}`)
        const pullResult = await pullRepository({
          projectId,
          branch,
          repositoryUrl,
          token,
        })
        commitSha = pullResult.commitSha
        status = 'fresh'

        // Update database
        await db
          .update(sourceCodes)
          .set({
            commit_sha: pullResult.commitSha,
            synced_at: new Date(),
          })
          .where(eq(sourceCodes.id, codebaseId))
      }

      // Create state with new lease
      const lease: LeaseRecord = {
        leaseId: leaserId,
        projectId,
        branch,
        acquiredAt: new Date(),
        ttlMinutes,
      }

      const state: CodebaseState = {
        projectId,
        branch,
        localPath,
        commitSha,
        leases: new Map([[leaserId, lease]]),
        lastAccessedAt: new Date(),
        cleanupEligibleAt: null,
      }
      codebaseStates.set(key, state)

      console.log(`[codebase.manager] Registered existing clone: ${key}`)

      return {
        localPath,
        leaseId: leaserId,
        commitSha,
        status,
      }
    }

    // Fresh clone needed
    console.log(`[codebase.manager] Cloning repository for ${key}`)
    const cloneResult = await cloneRepository({
      repositoryUrl,
      branch,
      projectId,
      token,
    })

    // Update database
    await db
      .update(sourceCodes)
      .set({
        commit_sha: cloneResult.commitSha,
        synced_at: new Date(),
      })
      .where(eq(sourceCodes.id, codebaseId))

    // Create state with new lease
    const lease: LeaseRecord = {
      leaseId: leaserId,
      projectId,
      branch,
      acquiredAt: new Date(),
      ttlMinutes,
    }

    const state: CodebaseState = {
      projectId,
      branch,
      localPath: cloneResult.localPath,
      commitSha: cloneResult.commitSha,
      leases: new Map([[leaserId, lease]]),
      lastAccessedAt: new Date(),
      cleanupEligibleAt: null,
    }
    codebaseStates.set(key, state)

    console.log(`[codebase.manager] Created new clone: ${key}`)

    return {
      localPath: cloneResult.localPath,
      leaseId: leaserId,
      commitSha: cloneResult.commitSha,
      status: 'fresh',
    }
  } catch (error) {
    if (error instanceof GitOperationError) {
      console.error(`[codebase.manager] Git error: ${error.code} - ${error.message}`)
      return {
        localPath: null,
        leaseId: leaserId,
        commitSha: null,
        status: 'unavailable',
        error: error.userMessage,
      }
    }

    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error(`[codebase.manager] Unexpected error:`, message)
    return {
      localPath: null,
      leaseId: leaserId,
      commitSha: null,
      status: 'unavailable',
      error: 'An unexpected error occurred while syncing the codebase.',
    }
  }
}

/**
 * Release a codebase lease. Cleans up the codebase if no other leases remain.
 *
 * @param leaseId - The lease ID returned from acquireCodebase
 * @param options.forceCleanup - If true, cleanup immediately instead of deferring (default: false, cleanup is deferred)
 */
export async function releaseCodebase(
  leaseId: string,
  options: { forceCleanup?: boolean } = {}
): Promise<void> {
  const { forceCleanup = false } = options
  console.log(`[codebase.manager] Releasing lease: ${leaseId}, forceCleanup: ${forceCleanup}`)

  // Find the state containing this lease
  for (const [key, state] of codebaseStates.entries()) {
    if (state.leases.has(leaseId)) {
      state.leases.delete(leaseId)
      console.log(`[codebase.manager] Removed lease from ${key}, remaining: ${state.leases.size}`)

      // If no more leases, handle cleanup
      if (state.leases.size === 0) {
        if (forceCleanup) {
          // Immediate cleanup (explicit opt-in)
          console.log(`[codebase.manager] No remaining leases, force cleaning up: ${key}`)
          try {
            await cleanupRepository(state.projectId, state.branch)
            codebaseStates.delete(key)
            console.log(`[codebase.manager] Cleanup complete: ${key}`)
          } catch (error) {
            console.warn(`[codebase.manager] Cleanup failed for ${key}:`, error)
          }
        } else {
          // Defer cleanup (default) - set grace period for background interval to handle
          state.cleanupEligibleAt = new Date(Date.now() + CLEANUP_GRACE_MS)
          console.log(`[codebase.manager] Deferred cleanup for ${key} until ${state.cleanupEligibleAt.toISOString()}`)
        }
      }

      return
    }
  }

  console.log(`[codebase.manager] Lease not found (may already be released): ${leaseId}`)
}

/**
 * Get the current state of all managed codebases.
 * Useful for debugging and monitoring.
 */
export function getCodebaseStates(): Array<{
  key: string
  projectId: string
  branch: string
  localPath: string
  commitSha: string | null
  leaseCount: number
  leaseIds: string[]
  lastAccessedAt: Date
}> {
  return Array.from(codebaseStates.entries()).map(([key, state]) => ({
    key,
    projectId: state.projectId,
    branch: state.branch,
    localPath: state.localPath,
    commitSha: state.commitSha,
    leaseCount: state.leases.size,
    leaseIds: Array.from(state.leases.keys()),
    lastAccessedAt: state.lastAccessedAt,
  }))
}
