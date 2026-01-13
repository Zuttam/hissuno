/**
 * Codebase types for GitHub repository management
 *
 * Note: Codebases are now git-only. Repositories are cloned to ephemeral
 * local directories during analysis and cleaned up afterward.
 */

import type { Database } from '@/types/supabase'

/** Database row type for source_codes table */
export type CodebaseRecord = Database['public']['Tables']['source_codes']['Row']

/** Insert type for source_codes table */
export type CodebaseInsert = Database['public']['Tables']['source_codes']['Insert']

/** Update type for source_codes table */
export type CodebaseUpdate = Database['public']['Tables']['source_codes']['Update']

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
