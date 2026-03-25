/**
 * Codebase types for GitHub repository management
 *
 * Note: Codebases are now git-only. Repositories are cloned to ephemeral
 * local directories during analysis and cleaned up afterward.
 */

import { sourceCodes } from '@/lib/db/schema/app'

/** Database row type for source_codes table */
export type CodebaseRecord = typeof sourceCodes.$inferSelect

/** Insert type for source_codes table */
export type CodebaseInsert = typeof sourceCodes.$inferInsert

/** Update type for source_codes table */
export type CodebaseUpdate = Partial<CodebaseInsert>

/** Parameters for creating a GitHub codebase reference */
export interface CreateGitHubCodebaseParams {
  repositoryUrl: string
  repositoryBranch: string
  userId: string
}

/** Result from syncing a GitHub codebase */
export interface SyncCodebaseResult {
  status: 'synced' | 'already_up_to_date' | 'error'
  commitSha?: string
  localPath?: string
  error?: string
}
