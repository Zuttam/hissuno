/**
 * Codebase service - business logic for codebase operations
 *
 * Uses native git operations instead of storage bucket.
 * Repositories are cloned into ephemeral directories under /tmp/hissuno/
 */

import { db } from '@/lib/db'
import { sourceCodes } from '@/lib/db/schema/app'
import { eq, and } from 'drizzle-orm'
import { getGitHubInstallationToken, getLatestCommitSha, parseGitHubRepoUrl } from '@/lib/integrations/github'
import { cloneRepository, pullRepository, cleanupRepository, repositoryExists, getLocalPath, getCurrentCommitSha, GitOperationError } from './git-operations'
import type { CodebaseRecord } from './types'

/**
 * Creates a codebase record for a GitHub repository.
 * No file upload needed - just stores the repository URL and branch.
 */
export async function createGitHubCodebase(params: {
  repositoryUrl: string
  repositoryBranch: string
  userId: string
}): Promise<{ codebase: CodebaseRecord }> {
  const { repositoryUrl, repositoryBranch, userId } = params

  const [codebase] = await db
    .insert(sourceCodes)
    .values({
      kind: 'github',
      repository_url: repositoryUrl,
      repository_branch: repositoryBranch,
      user_id: userId,
    })
    .returning()

  if (!codebase) {
    console.error('[codebase.service] Failed to create GitHub codebase record')
    throw new Error('Failed to create GitHub codebase record.')
  }

  return { codebase }
}

/**
 * Deletes a codebase record and cleans up any local clones.
 */
export async function deleteCodebase(
  codebaseId: string,
  userId: string,
  projectId?: string
): Promise<void> {
  // Retrieve the codebase record
  const [codebase] = await db
    .select()
    .from(sourceCodes)
    .where(
      and(
        eq(sourceCodes.id, codebaseId),
        eq(sourceCodes.user_id, userId)
      )
    )
    .limit(1)

  if (!codebase) {
    console.error('[codebase.service] Failed to fetch codebase:', codebaseId)
    throw new Error('Codebase not found.')
  }

  // Delete the database record first
  const deleted = await db
    .delete(sourceCodes)
    .where(
      and(
        eq(sourceCodes.id, codebaseId),
        eq(sourceCodes.user_id, userId)
      )
    )
    .returning({ id: sourceCodes.id })

  if (deleted.length === 0) {
    console.error('[codebase.service] Failed to delete codebase record:', codebaseId)
    throw new Error('Failed to delete codebase.')
  }

  // Clean up local clone if exists (best-effort)
  if (projectId && codebase.repository_branch) {
    try {
      await cleanupRepository(projectId, codebase.repository_branch)
    } catch (error) {
      console.warn('[codebase.service] Failed to cleanup local clone:', error)
    }
  }
}

/**
 * Gets a codebase record by ID, ensuring user ownership.
 */
export async function getCodebaseById(
  codebaseId: string,
  userId: string
): Promise<CodebaseRecord | null> {
  const [data] = await db
    .select()
    .from(sourceCodes)
    .where(
      and(
        eq(sourceCodes.id, codebaseId),
        eq(sourceCodes.user_id, userId)
      )
    )
    .limit(1)

  return data ?? null
}

/**
 * Updates a GitHub codebase record with new repository URL and/or branch.
 */
export async function updateGitHubCodebase(
  codebaseId: string,
  userId: string,
  updates: { repositoryUrl?: string; repositoryBranch?: string },
  projectId?: string
): Promise<CodebaseRecord> {
  // Get current record to check for branch change
  const [current] = await db
    .select({ repository_branch: sourceCodes.repository_branch })
    .from(sourceCodes)
    .where(
      and(
        eq(sourceCodes.id, codebaseId),
        eq(sourceCodes.user_id, userId)
      )
    )
    .limit(1)

  const updateData: Record<string, string> = {}

  if (updates.repositoryUrl) {
    updateData.repository_url = updates.repositoryUrl
  }
  if (updates.repositoryBranch) {
    updateData.repository_branch = updates.repositoryBranch
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('No updates provided.')
  }

  const [data] = await db
    .update(sourceCodes)
    .set(updateData)
    .where(
      and(
        eq(sourceCodes.id, codebaseId),
        eq(sourceCodes.user_id, userId)
      )
    )
    .returning()

  if (!data) {
    console.error('[codebase.service] Failed to update GitHub codebase:', codebaseId)
    throw new Error('Failed to update GitHub codebase.')
  }

  // If branch changed, cleanup old clone
  if (projectId && current?.repository_branch && updates.repositoryBranch && current.repository_branch !== updates.repositoryBranch) {
    try {
      await cleanupRepository(projectId, current.repository_branch)
    } catch {
      // Ignore cleanup errors
    }
  }

  return data
}

export type SyncGitHubCodebaseResult = {
  status: 'synced' | 'already_up_to_date' | 'error'
  commitSha?: string
  localPath?: string
  error?: string
}

/**
 * Syncs a GitHub codebase by cloning or pulling the repository.
 * Uses native git operations instead of tarball download.
 */
export async function syncGitHubCodebase(params: {
  codebaseId: string
  userId: string
  projectId: string
}): Promise<SyncGitHubCodebaseResult> {
  const { codebaseId, userId, projectId } = params

  // 1. Fetch the source_code record
  const [codebase] = await db
    .select()
    .from(sourceCodes)
    .where(eq(sourceCodes.id, codebaseId))
    .limit(1)

  if (!codebase) {
    console.error('[codebase.sync] Failed to fetch codebase:', codebaseId)
    return { status: 'error', error: 'Codebase not found.' }
  }

  if (codebase.kind !== 'github') {
    return { status: 'error', error: 'Codebase is not a GitHub source.' }
  }

  if (!codebase.repository_url || !codebase.repository_branch) {
    return { status: 'error', error: 'Missing repository URL or branch.' }
  }

  // 2. Get the project's GitHub installation token
  const ghResult = await getGitHubInstallationToken(projectId)
  if (!ghResult) {
    return { status: 'error', error: 'GitHub integration not connected for this project.' }
  }
  const token = ghResult.token

  // 3. Parse repository URL
  const parsed = parseGitHubRepoUrl(codebase.repository_url)
  if (!parsed) {
    return { status: 'error', error: 'Invalid repository URL.' }
  }

  const { owner, repo } = parsed
  const branch = codebase.repository_branch

  try {
    // 4. Get the latest commit SHA from remote
    const latestSha = await getLatestCommitSha(token, owner, repo, branch)

    // 5. Check if already cloned and up-to-date
    const exists = await repositoryExists(projectId, branch)

    if (exists) {
      const currentSha = await getCurrentCommitSha(projectId, branch)

      if (currentSha === latestSha) {
        console.log('[codebase.sync] Already up to date:', latestSha)
        return {
          status: 'already_up_to_date',
          commitSha: latestSha,
          localPath: getLocalPath(projectId, branch),
        }
      }

      // Pull latest changes
      console.log('[codebase.sync] Pulling latest changes for', owner, repo, branch)
      const pullResult = await pullRepository({
        projectId,
        branch,
        repositoryUrl: codebase.repository_url,
        token,
      })

      // Update database record
      await db
        .update(sourceCodes)
        .set({
          commit_sha: pullResult.commitSha,
          synced_at: new Date(),
        })
        .where(eq(sourceCodes.id, codebaseId))

      return {
        status: 'synced',
        commitSha: pullResult.commitSha,
        localPath: getLocalPath(projectId, branch),
      }
    }

    // 6. Fresh clone
    console.log('[codebase.sync] Cloning repository', owner, repo, branch)
    const cloneResult = await cloneRepository({
      repositoryUrl: codebase.repository_url,
      branch,
      projectId,
      token,
    })

    // 7. Update the database record
    await db
      .update(sourceCodes)
      .set({
        commit_sha: cloneResult.commitSha,
        synced_at: new Date(),
      })
      .where(eq(sourceCodes.id, codebaseId))

    console.log('[codebase.sync] Cloned successfully:', cloneResult.commitSha)
    return {
      status: 'synced',
      commitSha: cloneResult.commitSha,
      localPath: cloneResult.localPath,
    }
  } catch (error) {
    if (error instanceof GitOperationError) {
      console.error('[codebase.sync] Git operation error:', error.code, error.message)
      return { status: 'error', error: error.userMessage }
    }
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[codebase.sync] Error syncing codebase:', message)
    return { status: 'error', error: 'An unexpected error occurred while syncing the codebase.' }
  }
}

/**
 * Cleans up a project's local codebase clone.
 * Call this after analysis is complete.
 */
export async function cleanupProjectCodebase(projectId: string, branch: string): Promise<void> {
  await cleanupRepository(projectId, branch)
}

/**
 * Gets the local path for a project's codebase.
 */
export function getProjectCodebasePath(projectId: string, branch: string): string {
  return getLocalPath(projectId, branch)
}
