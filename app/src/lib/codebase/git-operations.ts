/**
 * Git Operations Module
 *
 * Provides functions for cloning, pulling, and managing ephemeral git repositories.
 * Repositories are cloned into /tmp/hissuno/{projectId}-{branch}/ and cleaned up after analysis.
 */

import simpleGit, { SimpleGit } from 'simple-git'
import { rm, mkdir, access } from 'fs/promises'
import { join } from 'path'

const CLONE_BASE_DIR = '/tmp/hissuno'

export interface CloneResult {
  localPath: string
  commitSha: string
}

export interface PullResult {
  commitSha: string
  updated: boolean
}

/**
 * Generates the local path for a cloned repository.
 * Format: /tmp/hissuno/{projectId}-{sanitizedBranch}
 */
export function getLocalPath(projectId: string, branch: string): string {
  // Sanitize branch name for filesystem (replace / with -)
  const sanitizedBranch = branch.replace(/\//g, '-')
  return join(CLONE_BASE_DIR, `${projectId}-${sanitizedBranch}`)
}

/**
 * Checks if a repository clone exists locally.
 */
export async function repositoryExists(projectId: string, branch: string): Promise<boolean> {
  const localPath = getLocalPath(projectId, branch)
  try {
    await access(localPath)
    return true
  } catch {
    return false
  }
}

/**
 * Clones a GitHub repository to an ephemeral local directory.
 * Uses shallow clone (depth=1) for efficiency.
 */
export async function cloneRepository(params: {
  repositoryUrl: string
  branch: string
  projectId: string
  token: string
}): Promise<CloneResult> {
  const { repositoryUrl, branch, projectId, token } = params
  const localPath = getLocalPath(projectId, branch)

  // Ensure base directory exists
  await mkdir(CLONE_BASE_DIR, { recursive: true })

  // Clean up if exists (fresh clone)
  await cleanupRepository(projectId, branch)

  // Build authenticated URL
  // Supports both https://github.com/owner/repo and https://github.com/owner/repo.git
  const authUrl = repositoryUrl.replace(
    /^https:\/\/github\.com\//,
    `https://oauth2:${token}@github.com/`
  )

  const git: SimpleGit = simpleGit()

  // Clone with depth 1 for efficiency (shallow clone)
  await git.clone(authUrl, localPath, [
    '--branch',
    branch,
    '--depth',
    '1',
    '--single-branch',
  ])

  // Get current commit SHA
  const localGit = simpleGit(localPath)
  const log = await localGit.log({ maxCount: 1 })
  const commitSha = log.latest?.hash || ''

  return { localPath, commitSha }
}

/**
 * Pulls the latest changes for an already cloned repository.
 * Returns whether there were new commits.
 */
export async function pullRepository(params: {
  projectId: string
  branch: string
}): Promise<PullResult> {
  const { projectId, branch } = params
  const localPath = getLocalPath(projectId, branch)

  // Check if repo exists
  const exists = await repositoryExists(projectId, branch)
  if (!exists) {
    throw new Error('Repository not cloned. Call cloneRepository first.')
  }

  const git = simpleGit(localPath)

  // Get current SHA before pull
  const beforeLog = await git.log({ maxCount: 1 })
  const beforeSha = beforeLog.latest?.hash

  // Pull latest
  await git.pull()

  // Get SHA after pull
  const afterLog = await git.log({ maxCount: 1 })
  const afterSha = afterLog.latest?.hash || ''

  return {
    commitSha: afterSha,
    updated: beforeSha !== afterSha,
  }
}

/**
 * Removes an ephemeral repository directory.
 * Safe to call even if directory doesn't exist.
 */
export async function cleanupRepository(projectId: string, branch: string): Promise<void> {
  const localPath = getLocalPath(projectId, branch)

  try {
    await rm(localPath, { recursive: true, force: true })
  } catch {
    // Ignore if doesn't exist
  }
}

/**
 * Gets the current commit SHA for a cloned repository.
 */
export async function getCurrentCommitSha(projectId: string, branch: string): Promise<string | null> {
  const localPath = getLocalPath(projectId, branch)

  const exists = await repositoryExists(projectId, branch)
  if (!exists) {
    return null
  }

  try {
    const git = simpleGit(localPath)
    const log = await git.log({ maxCount: 1 })
    return log.latest?.hash || null
  } catch {
    return null
  }
}
