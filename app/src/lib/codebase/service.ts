/**
 * Codebase service - business logic for codebase operations
 *
 * Uses native git operations instead of storage bucket.
 * Repositories are cloned into ephemeral directories under /tmp/hissuno/
 */

import { db } from '@/lib/db'
import { codebases } from '@/lib/db/schema/app'
import { eq } from 'drizzle-orm'
import { getGitHubInstallationToken, getLatestCommitSha, parseGitHubRepoUrl } from '@/lib/integrations/github'
import { cloneRepository, pullRepository, cleanupRepository, repositoryExists, getLocalPath, getCurrentCommitSha, GitOperationError } from './git-operations'
import type { CodebaseRecord } from './types'

/**
 * Creates a codebase record for a GitHub repository.
 * No file upload needed - just stores the repository URL and branch.
 */
export async function createGitHubCodebase(params: {
  projectId: string
  repositoryUrl: string
  repositoryBranch: string
  userId: string
  name?: string | null
  description?: string | null
  analysisScope?: string | null
}): Promise<{ codebase: CodebaseRecord }> {
  const { projectId, repositoryUrl, repositoryBranch, userId, name, description, analysisScope } = params

  const [codebase] = await db
    .insert(codebases)
    .values({
      project_id: projectId,
      kind: 'github',
      repository_url: repositoryUrl,
      repository_branch: repositoryBranch,
      user_id: userId,
      name: name ?? null,
      description: description ?? null,
      analysis_scope: analysisScope ?? null,
    })
    .returning()

  if (!codebase) {
    console.error('[codebase.service] Failed to create GitHub codebase record')
    throw new Error('Failed to create GitHub codebase record.')
  }

  return { codebase }
}

/**
 * Deletes a codebase record and cleans up any local clones. Authorization
 * (project access) is enforced by the calling route handler — this function
 * is the data-layer service.
 */
export async function deleteCodebase(
  codebaseId: string,
  projectId?: string
): Promise<void> {
  const deleted = await db
    .delete(codebases)
    .where(eq(codebases.id, codebaseId))
    .returning({ branch: codebases.repository_branch })

  if (deleted.length === 0) {
    throw new Error('Codebase not found.')
  }

  if (projectId && deleted[0].branch) {
    try {
      await cleanupRepository(projectId, deleted[0].branch)
    } catch (error) {
      console.warn('[codebase.service] Failed to cleanup local clone:', error)
    }
  }
}

/**
 * Gets a codebase record by ID. Authorization is enforced by the caller.
 */
export async function getCodebaseById(codebaseId: string): Promise<CodebaseRecord | null> {
  const [data] = await db
    .select()
    .from(codebases)
    .where(eq(codebases.id, codebaseId))
    .limit(1)

  return data ?? null
}

/**
 * Updates a GitHub codebase record with new repository URL and/or branch.
 * Authorization is enforced by the caller.
 */
export async function updateGitHubCodebase(
  codebaseId: string,
  updates: { repositoryUrl?: string; repositoryBranch?: string },
  projectId?: string
): Promise<CodebaseRecord> {
  const [current] = await db
    .select({ repository_branch: codebases.repository_branch })
    .from(codebases)
    .where(eq(codebases.id, codebaseId))
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
    .update(codebases)
    .set(updateData)
    .where(eq(codebases.id, codebaseId))
    .returning()

  if (!data) {
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
 */
export async function syncGitHubCodebase(params: {
  codebaseId: string
  projectId: string
}): Promise<SyncGitHubCodebaseResult> {
  const { codebaseId, projectId } = params

  const [codebase] = await db
    .select()
    .from(codebases)
    .where(eq(codebases.id, codebaseId))
    .limit(1)

  if (!codebase) {
    return { status: 'error', error: 'Codebase not found.' }
  }

  if (codebase.kind !== 'github') {
    return { status: 'error', error: 'Codebase is not a GitHub source.' }
  }

  if (!codebase.repository_url || !codebase.repository_branch) {
    return { status: 'error', error: 'Missing repository URL or branch.' }
  }

  const ghResult = await getGitHubInstallationToken(projectId)
  if (!ghResult) {
    return { status: 'error', error: 'GitHub integration not connected for this project.' }
  }
  const token = ghResult.token

  const parsed = parseGitHubRepoUrl(codebase.repository_url)
  if (!parsed) {
    return { status: 'error', error: 'Invalid repository URL.' }
  }

  const { owner, repo } = parsed
  const branch = codebase.repository_branch

  try {
    const latestSha = await getLatestCommitSha(token, owner, repo, branch)
    const exists = await repositoryExists(projectId, branch)

    if (exists) {
      const currentSha = await getCurrentCommitSha(projectId, branch)

      if (currentSha === latestSha) {
        return {
          status: 'already_up_to_date',
          commitSha: latestSha,
          localPath: getLocalPath(projectId, branch),
        }
      }

      const pullResult = await pullRepository({
        projectId,
        branch,
        repositoryUrl: codebase.repository_url,
        token,
      })

      await db
        .update(codebases)
        .set({ commit_sha: pullResult.commitSha, synced_at: new Date() })
        .where(eq(codebases.id, codebaseId))

      return {
        status: 'synced',
        commitSha: pullResult.commitSha,
        localPath: getLocalPath(projectId, branch),
      }
    }

    const cloneResult = await cloneRepository({
      repositoryUrl: codebase.repository_url,
      branch,
      projectId,
      token,
    })

    await db
      .update(codebases)
      .set({ commit_sha: cloneResult.commitSha, synced_at: new Date() })
      .where(eq(codebases.id, codebaseId))

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
