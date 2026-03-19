/**
 * Storage utilities for knowledge document files (user uploads).
 *
 * Uses the pluggable FileStorageProvider for actual storage operations.
 * Analyzed content is now stored directly in the DB, not in blob storage.
 */

import { getStorageProvider } from '@/lib/storage'

/** Storage bucket for uploaded documents */
const DOCUMENTS_BUCKET = 'documents'

/** Maximum file size for uploaded documents (10MB) */
const MAX_DOCUMENT_SIZE = 10 * 1024 * 1024

/** Allowed file extensions and their expected MIME types */
const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.txt': ['text/plain'],
  '.md': ['text/markdown', 'text/plain'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
}

/** Magic byte signatures for file type verification */
const FILE_SIGNATURES: { ext: string; bytes: number[] }[] = [
  { ext: '.pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { ext: '.docx', bytes: [0x50, 0x4b, 0x03, 0x04] },
  { ext: '.doc', bytes: [0xd0, 0xcf, 0x11, 0xe0] },
]

/**
 * Validates an uploaded file for security.
 * Returns null if valid, or an error message string if invalid.
 */
export async function validateUploadedFile(file: File): Promise<string | null> {
  if (file.size > MAX_DOCUMENT_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    return `File size (${sizeMB}MB) exceeds the 10MB limit.`
  }

  if (file.size === 0) {
    return 'File is empty.'
  }

  const name = file.name.toLowerCase()
  const ext = name.includes('.') ? `.${name.split('.').pop()}` : ''
  const allowedMimes = ALLOWED_FILE_TYPES[ext]

  if (!allowedMimes) {
    const allowed = Object.keys(ALLOWED_FILE_TYPES).join(', ')
    return `File type "${ext || 'unknown'}" is not allowed. Allowed types: ${allowed}`
  }

  if (file.type && !allowedMimes.includes(file.type)) {
    return `MIME type "${file.type}" does not match expected types for ${ext} files.`
  }

  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const expectedSig = FILE_SIGNATURES.find((s) => s.ext === ext)

  if (expectedSig) {
    const matches = expectedSig.bytes.every((b, i) => header[i] === b)
    if (!matches) {
      return `File content does not match its ${ext} extension (invalid file signature).`
    }
  } else {
    const chunk = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
    for (const byte of chunk) {
      if (byte < 0x09 || (byte > 0x0d && byte < 0x20 && byte !== 0x1b)) {
        return `File appears to contain binary content but has a text extension (${ext}).`
      }
    }
  }

  return null
}

/**
 * Generates a storage path for an uploaded document.
 */
export function getDocumentPath(projectId: string, filename: string): string {
  const timestamp = Date.now()
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `${projectId}/docs/${timestamp}-${sanitizedFilename}`
}

/**
 * Uploads a document file via the storage provider.
 */
export async function uploadDocument(
  projectId: string,
  file: File,
): Promise<{ path: string; error: Error | null }> {
  const storagePath = getDocumentPath(projectId, file.name)
  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  const storage = getStorageProvider()
  const { error } = await storage.upload(DOCUMENTS_BUCKET, storagePath, buffer, {
    contentType: file.type || 'application/octet-stream',
    upsert: false,
  })

  if (error) {
    console.error('[knowledge.storage] Failed to upload document:', error)
    return { path: storagePath, error }
  }

  return { path: storagePath, error: null }
}

/**
 * Downloads a document file via the storage provider.
 */
export async function downloadDocument(
  storagePath: string,
): Promise<{ data: Blob | null; error: Error | null }> {
  const storage = getStorageProvider()
  return storage.download(DOCUMENTS_BUCKET, storagePath)
}

/**
 * Deletes a document via the storage provider.
 */
export async function deleteDocument(
  storagePath: string,
): Promise<{ error: Error | null }> {
  const storage = getStorageProvider()
  return storage.delete(DOCUMENTS_BUCKET, [storagePath])
}
