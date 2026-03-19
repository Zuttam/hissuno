/**
 * Git Operations Module
 *
 * Provides functions for cloning, pulling, and managing ephemeral git repositories.
 * Uses isomorphic-git (pure JS) for Vercel serverless compatibility.
 * Repositories are cloned into /tmp/hissuno/{projectId}-{branch}/ and cleaned up after analysis.
 */

import * as git from 'isomorphic-git'
import http from 'isomorphic-git/http/node'
import * as fs from 'fs'
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
 * Custom error class for git operations with user-friendly messages.
 */
export class GitOperationError extends Error {
  constructor(
    public code: 'AUTH_FAILED' | 'REPO_NOT_FOUND' | 'CLONE_FAILED' | 'PULL_FAILED' | 'NETWORK_ERROR',
    public userMessage: string,
    originalError?: Error
  ) {
    super(userMessage)
    this.name = 'GitOperationError'
    this.cause = originalError
  }
}

/**
 * Classifies an error and throws a GitOperationError with a user-friendly message.
 */
function classifyAndThrow(error: unknown, operation: 'clone' | 'pull'): never {
  const msg = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase()

  if (msg.includes('401') || msg.includes('authentication') || msg.includes('unauthorized')) {
    throw new GitOperationError(
      'AUTH_FAILED',
      'GitHub authentication failed. Please reconnect your GitHub account.',
      error instanceof Error ? error : undefined
    )
  }

  if (msg.includes('404') || msg.includes('not found') || msg.includes('repository not found')) {
    throw new GitOperationError(
      'REPO_NOT_FOUND',
      "Repository not found or you don't have access. Please check the repository URL and permissions.",
      error instanceof Error ? error : undefined
    )
  }

  if (msg.includes('network') || msg.includes('enotfound') || msg.includes('timeout') || msg.includes('econnrefused')) {
    throw new GitOperationError(
      'NETWORK_ERROR',
      'Network error while accessing GitHub. Please try again.',
      error instanceof Error ? error : undefined
    )
  }

  const defaultCode = operation === 'clone' ? 'CLONE_FAILED' : 'PULL_FAILED'
  throw new GitOperationError(
    defaultCode,
    `Failed to ${operation} repository. Please try again.`,
    error instanceof Error ? error : undefined
  )
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
    // Also verify it's a git repository
    await git.resolveRef({ fs, dir: localPath, ref: 'HEAD' })
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

  // Create the target directory
  await mkdir(localPath, { recursive: true })

  try {
    // Clone with depth 1 for efficiency (shallow clone)
    await git.clone({
      fs,
      http,
      dir: localPath,
      url: repositoryUrl,
      ref: branch,
      singleBranch: true,
      depth: 1,
      onAuth: () => ({ username: 'x-access-token', password: token }),
    })

    // Get current commit SHA
    const commits = await git.log({ fs, dir: localPath, depth: 1 })
    const commitSha = commits[0]?.oid || ''

    return { localPath, commitSha }
  } catch (error) {
    // Clean up on failure
    await cleanupRepository(projectId, branch)
    classifyAndThrow(error, 'clone')
  }
}

/**
 * Pulls the latest changes for an already cloned repository.
 * Returns whether there were new commits.
 */
export async function pullRepository(params: {
  projectId: string
  branch: string
  repositoryUrl: string
  token: string
}): Promise<PullResult> {
  const { projectId, branch, token } = params
  const localPath = getLocalPath(projectId, branch)

  // Check if repo exists
  const exists = await repositoryExists(projectId, branch)
  if (!exists) {
    throw new GitOperationError('PULL_FAILED', 'Repository not cloned. Please sync the codebase first.')
  }

  try {
    // Get current SHA before pull
    const beforeCommits = await git.log({ fs, dir: localPath, depth: 1 })
    const beforeSha = beforeCommits[0]?.oid

    // Fetch latest changes
    await git.fetch({
      fs,
      http,
      dir: localPath,
      ref: branch,
      singleBranch: true,
      onAuth: () => ({ username: 'x-access-token', password: token }),
    })

    // Fast-forward merge to origin/branch
    await git.merge({
      fs,
      dir: localPath,
      ours: branch,
      theirs: `origin/${branch}`,
      fastForward: true,
      abortOnConflict: true,
      author: { name: 'Hissuno', email: 'noreply@hissuno.com' },
    })

    // Checkout to update working directory
    await git.checkout({
      fs,
      dir: localPath,
      ref: branch,
      force: true,
    })

    // Get SHA after pull
    const afterCommits = await git.log({ fs, dir: localPath, depth: 1 })
    const afterSha = afterCommits[0]?.oid || ''

    return {
      commitSha: afterSha,
      updated: beforeSha !== afterSha,
    }
  } catch (error) {
    classifyAndThrow(error, 'pull')
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
    const commits = await git.log({ fs, dir: localPath, depth: 1 })
    return commits[0]?.oid || null
  } catch {
    return null
  }
}
