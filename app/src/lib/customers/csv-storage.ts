/**
 * Supabase Storage utilities for CSV import files.
 *
 * CSV imports live under the `documents` bucket at:
 *   {projectId}/csv-imports/{timestamp}-{sanitized-filename}
 *
 * All operations REQUIRE an authenticated Supabase client (user-initiated).
 */

import type { SupabaseClient } from '@supabase/supabase-js'

const DOCUMENTS_BUCKET = 'documents'

/** Maximum CSV file size (5MB) */
const MAX_CSV_FILE_SIZE = 5 * 1024 * 1024

/**
 * Validates a CSV filename: must end with .csv, reasonable length, no path traversal.
 * Returns null if valid, or an error message string if invalid.
 */
export function validateCSVFileName(filename: string): string | null {
  if (!filename || filename.length === 0) {
    return 'Filename is required.'
  }

  if (filename.length > 255) {
    return 'Filename is too long (max 255 characters).'
  }

  const lower = filename.toLowerCase()
  if (!lower.endsWith('.csv')) {
    return 'File must have a .csv extension.'
  }

  // Block path traversal
  if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
    return 'Invalid filename.'
  }

  return null
}

/**
 * Generates a sanitized storage path for a CSV import file.
 */
export function getCSVImportPath(projectId: string, filename: string): string {
  const timestamp = Date.now()
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `${projectId}/csv-imports/${timestamp}-${sanitizedFilename}`
}

/**
 * Creates a presigned upload URL for a CSV file.
 * The client uploads directly to Supabase Storage using this URL.
 */
export async function createCSVUploadUrl(
  projectId: string,
  filename: string,
  supabase: SupabaseClient
): Promise<{ uploadUrl: string; token: string; storagePath: string; error: Error | null }> {
  const storagePath = getCSVImportPath(projectId, filename)

  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUploadUrl(storagePath)

  if (error) {
    console.error('[csv-storage] Failed to create signed upload URL:', error)
    return { uploadUrl: '', token: '', storagePath: '', error: new Error(error.message) }
  }

  return {
    uploadUrl: data.signedUrl,
    token: data.token,
    storagePath,
    error: null,
  }
}

/**
 * Downloads a CSV file from storage and returns its text content.
 * REQUIRES an authenticated client.
 */
export async function downloadCSVImport(
  storagePath: string,
  supabase: SupabaseClient
): Promise<{ content: string | null; error: Error | null }> {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .download(storagePath)

  if (error) {
    console.error('[csv-storage] Failed to download CSV:', error)
    return { content: null, error: new Error(error.message) }
  }

  const content = await data.text()
  return { content, error: null }
}

/**
 * Deletes a CSV import file from storage (cleanup after import).
 * Best-effort — errors are logged but not propagated.
 */
export async function deleteCSVImport(
  storagePath: string,
  supabase: SupabaseClient
): Promise<{ error: Error | null }> {
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove([storagePath])

  if (error) {
    console.error('[csv-storage] Failed to delete CSV:', error)
    return { error: new Error(error.message) }
  }

  return { error: null }
}

export { MAX_CSV_FILE_SIZE }
