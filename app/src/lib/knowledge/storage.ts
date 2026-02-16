/**
 * Supabase Storage utilities for knowledge files
 *
 * Security Note:
 * - UPLOAD functions for knowledge packages default to admin client (workflow use)
 * - DOWNLOAD/READ functions REQUIRE an authenticated client to prevent data leakage
 * - User-facing document operations REQUIRE an authenticated client
 */

import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { KnowledgeCategory } from './types'

// Storage bucket for knowledge files
const KNOWLEDGE_BUCKET = 'knowledge'

// Storage bucket for uploaded documents
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
  { ext: '.pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { ext: '.docx', bytes: [0x50, 0x4b, 0x03, 0x04] }, // PK (ZIP)
  { ext: '.doc', bytes: [0xd0, 0xcf, 0x11, 0xe0] }, // OLE compound
]

/**
 * Validates an uploaded file for security:
 * - Extension allowlist
 * - MIME type validation
 * - Magic byte (file signature) verification
 * - File size check
 *
 * Returns null if valid, or an error message string if invalid.
 */
export async function validateUploadedFile(file: File): Promise<string | null> {
  // 1. Check file size
  if (file.size > MAX_DOCUMENT_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1)
    return `File size (${sizeMB}MB) exceeds the 10MB limit.`
  }

  if (file.size === 0) {
    return 'File is empty.'
  }

  // 2. Check file extension
  const name = file.name.toLowerCase()
  const ext = name.includes('.') ? `.${name.split('.').pop()}` : ''
  const allowedMimes = ALLOWED_FILE_TYPES[ext]

  if (!allowedMimes) {
    const allowed = Object.keys(ALLOWED_FILE_TYPES).join(', ')
    return `File type "${ext || 'unknown'}" is not allowed. Allowed types: ${allowed}`
  }

  // 3. Check MIME type against allowlist for the extension
  if (file.type && !allowedMimes.includes(file.type)) {
    return `MIME type "${file.type}" does not match expected types for ${ext} files.`
  }

  // 4. Validate magic bytes (file signature)
  const header = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const expectedSig = FILE_SIGNATURES.find((s) => s.ext === ext)

  if (expectedSig) {
    // Binary file: magic bytes must match
    const matches = expectedSig.bytes.every((b, i) => header[i] === b)
    if (!matches) {
      return `File content does not match its ${ext} extension (invalid file signature).`
    }
  } else {
    // Text file (.txt, .md): should not contain binary bytes in the first chunk
    const chunk = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
    for (const byte of chunk) {
      // Allow common text control characters: tab, newline, carriage return
      if (byte < 0x09 || (byte > 0x0d && byte < 0x20 && byte !== 0x1b)) {
        return `File appears to contain binary content but has a text extension (${ext}).`
      }
    }
  }

  return null
}

/**
 * Generates a storage path for a knowledge package markdown file
 */
export function getKnowledgePackagePath(projectId: string, category: KnowledgeCategory, version: number): string {
  return `${projectId}/${category}-v${version}.md`
}

/**
 * Generates a storage path for an uploaded document
 */
export function getDocumentPath(projectId: string, filename: string): string {
  const timestamp = Date.now()
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, '_')
  return `${projectId}/docs/${timestamp}-${sanitizedFilename}`
}

/**
 * Uploads a knowledge package markdown file to Supabase Storage.
 * Defaults to admin client for workflow use (no user context).
 * Automatically ensures the storage bucket exists before uploading.
 */
export async function uploadKnowledgePackage(
  projectId: string,
  category: KnowledgeCategory,
  content: string,
  version: number,
  supabase?: SupabaseClient
): Promise<{ path: string; error: Error | null }> {
  // Ensure bucket exists before uploading
  const { error: bucketError } = await ensureStorageBuckets()
  if (bucketError) {
    return { path: '', error: bucketError }
  }

  // Default to admin client for workflow context (no user session)
  const client = supabase ?? createAdminClient()
  const storagePath = getKnowledgePackagePath(projectId, category, version)

  const { error } = await client.storage
    .from(KNOWLEDGE_BUCKET)
    .upload(storagePath, content, {
      contentType: 'text/markdown',
      upsert: true,
    })

  if (error) {
    console.error(`[knowledge.storage] Failed to upload ${category} knowledge package:`, error)
    return { path: storagePath, error: new Error(error.message) }
  }

  return { path: storagePath, error: null }
}

/**
 * Downloads a knowledge package markdown file from Supabase Storage.
 * REQUIRES an authenticated client to prevent unauthorized access.
 */
export async function downloadKnowledgePackage(
  storagePath: string,
  supabase: SupabaseClient
): Promise<{ content: string | null; error: Error | null }> {
  const { data, error } = await supabase.storage
    .from(KNOWLEDGE_BUCKET)
    .download(storagePath)

  if (error) {
    console.error('[knowledge.storage] Failed to download knowledge package:', error)
    return { content: null, error: new Error(error.message) }
  }

  const content = await data.text()
  return { content, error: null }
}

/**
 * Uploads a document file to Supabase Storage.
 * REQUIRES an authenticated client (user-initiated upload).
 */
export async function uploadDocument(
  projectId: string,
  file: File,
  supabase: SupabaseClient
): Promise<{ path: string; error: Error | null }> {
  const storagePath = getDocumentPath(projectId, file.name)

  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (error) {
    console.error('[knowledge.storage] Failed to upload document:', error)
    return { path: storagePath, error: new Error(error.message) }
  }

  return { path: storagePath, error: null }
}

/**
 * Downloads a document file from Supabase Storage.
 * REQUIRES an authenticated client to prevent unauthorized access.
 */
export async function downloadDocument(
  storagePath: string,
  supabase: SupabaseClient
): Promise<{ data: Blob | null; error: Error | null }> {
  const { data, error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .download(storagePath)

  if (error) {
    console.error('[knowledge.storage] Failed to download document:', error)
    return { data: null, error: new Error(error.message) }
  }

  return { data, error: null }
}

/**
 * Deletes a document from Supabase Storage.
 * REQUIRES an authenticated client (user-initiated deletion).
 */
export async function deleteDocument(
  storagePath: string,
  supabase: SupabaseClient
): Promise<{ error: Error | null }> {
  const { error } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .remove([storagePath])

  if (error) {
    console.error('[knowledge.storage] Failed to delete document:', error)
    return { error: new Error(error.message) }
  }

  return { error: null }
}

/**
 * Deletes all knowledge packages for a project.
 * Defaults to admin client (typically called during project cleanup).
 */
export async function deleteProjectKnowledge(
  projectId: string,
  supabase?: SupabaseClient
): Promise<{ error: Error | null }> {
  const client = supabase ?? createAdminClient()

  // List all files in the project folder
  const { data: files, error: listError } = await client.storage
    .from(KNOWLEDGE_BUCKET)
    .list(projectId)

  if (listError) {
    console.error('[knowledge.storage] Failed to list knowledge files:', listError)
    return { error: new Error(listError.message) }
  }

  if (!files || files.length === 0) {
    return { error: null }
  }

  // Delete all files
  const filePaths = files.map((file: { name: string }) => `${projectId}/${file.name}`)
  const { error: deleteError } = await client.storage
    .from(KNOWLEDGE_BUCKET)
    .remove(filePaths)

  if (deleteError) {
    console.error('[knowledge.storage] Failed to delete knowledge files:', deleteError)
    return { error: new Error(deleteError.message) }
  }

  return { error: null }
}

/**
 * Gets a signed URL for viewing a knowledge package (valid for 1 hour).
 * REQUIRES an authenticated client to prevent unauthorized access.
 */
export async function getKnowledgePackageUrl(
  storagePath: string,
  supabase: SupabaseClient
): Promise<{ url: string | null; error: Error | null }> {
  const { data, error } = await supabase.storage
    .from(KNOWLEDGE_BUCKET)
    .createSignedUrl(storagePath, 3600) // 1 hour

  if (error) {
    console.error('[knowledge.storage] Failed to get signed URL:', error)
    return { url: null, error: new Error(error.message) }
  }

  return { url: data.signedUrl, error: null }
}

/**
 * Ensures the required storage buckets exist (admin operation).
 * If service role key is not configured, this is a no-op (assumes buckets were pre-created).
 */
export async function ensureStorageBuckets(): Promise<{ error: Error | null }> {
  // Skip if service role isn't configured - assume buckets were pre-created via Supabase dashboard or config.toml
  if (!isServiceRoleConfigured()) {
    return { error: null }
  }

  try {
    const client = createAdminClient()

    // Check and create knowledge bucket
    const { error: knowledgeError } = await client.storage.createBucket(KNOWLEDGE_BUCKET, {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024, // 10MB
      allowedMimeTypes: ['text/markdown', 'text/plain'],
    })

    if (knowledgeError && !knowledgeError.message.includes('already exists')) {
      console.error('[knowledge.storage] Failed to create knowledge bucket:', knowledgeError)
      return { error: new Error(knowledgeError.message) }
    }

    // Check and create documents bucket
    const { error: docsError } = await client.storage.createBucket(DOCUMENTS_BUCKET, {
      public: false,
      fileSizeLimit: 50 * 1024 * 1024, // 50MB
      allowedMimeTypes: [
        'application/pdf',
        'text/markdown',
        'text/plain',
        'text/csv',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ],
    })

    if (docsError && !docsError.message.includes('already exists')) {
      console.error('[knowledge.storage] Failed to create documents bucket:', docsError)
      return { error: new Error(docsError.message) }
    }

    return { error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to ensure storage buckets'
    return { error: new Error(message) }
  }
}
