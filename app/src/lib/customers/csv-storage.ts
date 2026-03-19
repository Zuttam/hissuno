/**
 * Storage utilities for CSV import files.
 *
 * CSV imports live under the `documents` bucket at:
 *   {projectId}/csv-imports/{timestamp}-{sanitized-filename}
 *
 * Uses the pluggable FileStorageProvider for storage operations.
 */

import { getStorageProvider } from '@/lib/storage'

const DOCUMENTS_BUCKET = 'documents'

/** Maximum CSV file size (5MB) */
const MAX_CSV_FILE_SIZE = 5 * 1024 * 1024

/**
 * Validates a CSV filename.
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
 * Note: Only supported by providers that implement signed uploads (e.g., Supabase).
 */
export async function createCSVUploadUrl(
  projectId: string,
  filename: string,
): Promise<{ uploadUrl: string; token: string; storagePath: string; error: Error | null }> {
  const storagePath = getCSVImportPath(projectId, filename)
  const storage = getStorageProvider()

  try {
    return await storage.createSignedUploadUrl(DOCUMENTS_BUCKET, storagePath)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create upload URL'
    console.error('[csv-storage] Failed to create signed upload URL:', message)
    return { uploadUrl: '', token: '', storagePath: '', error: new Error(message) }
  }
}

/**
 * Upload a CSV file directly (server-side).
 * Used when the storage provider doesn't support signed upload URLs.
 */
export async function uploadCSVDirect(
  projectId: string,
  filename: string,
  data: Uint8Array | string,
): Promise<{ storagePath: string; error: Error | null }> {
  const storagePath = getCSVImportPath(projectId, filename)
  const storage = getStorageProvider()

  const result = await storage.upload(DOCUMENTS_BUCKET, storagePath, data, {
    contentType: 'text/csv',
  })

  if (result.error) {
    return { storagePath: '', error: result.error }
  }

  return { storagePath, error: null }
}

/**
 * Downloads a CSV file from storage and returns its text content.
 */
export async function downloadCSVImport(
  storagePath: string,
): Promise<{ content: string | null; error: Error | null }> {
  const storage = getStorageProvider()
  return storage.downloadText(DOCUMENTS_BUCKET, storagePath)
}

/**
 * Deletes a CSV import file from storage (cleanup after import).
 */
export async function deleteCSVImport(
  storagePath: string,
): Promise<{ error: Error | null }> {
  const storage = getStorageProvider()
  return storage.delete(DOCUMENTS_BUCKET, [storagePath])
}

export { MAX_CSV_FILE_SIZE }
