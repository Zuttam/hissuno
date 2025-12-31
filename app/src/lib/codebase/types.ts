/**
 * Codebase types for source code storage and management
 */

import type { Database } from '@/types/supabase'

/** Database row type for source_codes table */
export type CodebaseRecord = Database['public']['Tables']['source_codes']['Row']

/** Insert type for source_codes table */
export type CodebaseInsert = Database['public']['Tables']['source_codes']['Insert']

/** Update type for source_codes table */
export type CodebaseUpdate = Database['public']['Tables']['source_codes']['Update']

/** Parameters for creating a codebase from folder upload */
export interface CreateCodebaseParams {
  files: File[]
  gitignore: File | null
  projectId: string
  userId: string
}

/** Result from creating a codebase */
export interface CreateCodebaseResult {
  codebase: CodebaseRecord
  storagePath: string
  fileCount: number
}

/** Parameters for uploading a codebase file */
export interface UploadCodebaseFileParams {
  projectId: string
  file: File
  relativePath: string
}

/** Result from uploading a codebase file */
export interface UploadCodebaseFileResult {
  path: string
  error: Error | null
}
