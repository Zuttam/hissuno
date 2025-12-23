/**
 * Supabase Storage utilities for codebase files
 *
 * Security Note:
 * - UPLOAD functions REQUIRE an authenticated client (user-initiated upload)
 * - DELETE functions default to admin client (workflow use during project cleanup)
 */

import { createAdminClient, isServiceRoleConfigured } from '@/lib/supabase/server'
import type { SupabaseClient } from '@supabase/supabase-js'

// Storage bucket for codebase files
const CODEBASE_BUCKET = 'codebases'

/**
 * Generates a storage path for a codebase file
 * Format: {userId}/{projectId}/{timestamp}/{relativePath}
 */
export function getCodebasePath(userId: string, projectId: string, relativePath: string, timestamp?: number): string {
  const ts = timestamp ?? Date.now()
  const sanitizedPath = relativePath.replace(/[^a-zA-Z0-9./_-]/g, '_')
  return `${userId}/${projectId}/${ts}/${sanitizedPath}`
}

/**
 * Gets the base storage path for a project's codebase
 * Format: {userId}/{projectId}/{timestamp}
 */
export function getCodebaseBasePath(userId: string, projectId: string, timestamp: number): string {
  return `${userId}/${projectId}/${timestamp}`
}

/**
 * Uploads a codebase file to Supabase Storage.
 * REQUIRES an authenticated client (user-initiated upload).
 */
export async function uploadCodebaseFile(
  userId: string,
  projectId: string,
  file: File,
  relativePath: string,
  timestamp: number,
  supabase: SupabaseClient
): Promise<{ path: string; error: Error | null }> {
  const storagePath = getCodebasePath(userId, projectId, relativePath, timestamp)

  const arrayBuffer = await file.arrayBuffer()
  const buffer = new Uint8Array(arrayBuffer)

  const { error } = await supabase.storage
    .from(CODEBASE_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    })

  if (error) {
    // Provide helpful error message for bucket not found
    if (error.message === 'Bucket not found') {
      console.error('[codebase.storage] Bucket "codebases" not found. Create it in Supabase dashboard or configure SUPABASE_SERVICE_ROLE_KEY.')
      return { path: storagePath, error: new Error('Storage bucket "codebases" not found. Please create it in Supabase dashboard.') }
    }
    console.error('[codebase.storage] Failed to upload file:', relativePath, error)
    return { path: storagePath, error: new Error(error.message) }
  }

  return { path: storagePath, error: null }
}

/**
 * Uploads a codebase file from a buffer (for GitHub sync).
 * Uses admin client for background operations.
 */
export async function uploadCodebaseBuffer(
  storagePath: string,
  buffer: Uint8Array,
  contentType: string = 'application/octet-stream',
  supabase?: SupabaseClient
): Promise<{ path: string; error: Error | null }> {
  const client = supabase ?? createAdminClient()

  const { error } = await client.storage
    .from(CODEBASE_BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: false,
    })

  if (error) {
    if (error.message === 'Bucket not found') {
      console.error('[codebase.storage] Bucket "codebases" not found.')
      return { path: storagePath, error: new Error('Storage bucket "codebases" not found.') }
    }
    console.error('[codebase.storage] Failed to upload buffer:', storagePath, error)
    return { path: storagePath, error: new Error(error.message) }
  }

  return { path: storagePath, error: null }
}

/**
 * Deletes all codebase files for a project.
 * Defaults to admin client (typically called during project cleanup).
 */
export async function deleteProjectCodebase(
  userId: string,
  projectId: string,
  supabase?: SupabaseClient
): Promise<{ error: Error | null }> {
  const client = supabase ?? createAdminClient()
  const projectPath = `${userId}/${projectId}`

  // List all files in the project folder
  const { data: folders, error: listError } = await client.storage
    .from(CODEBASE_BUCKET)
    .list(projectPath)

  if (listError) {
    console.error('[codebase.storage] Failed to list codebase folders:', listError)
    return { error: new Error(listError.message) }
  }

  if (!folders || folders.length === 0) {
    return { error: null }
  }

  // For each timestamp folder, list and delete all files
  const deletePromises: Promise<void>[] = []

  for (const folder of folders) {
    if (folder.name) {
      const folderPath = `${projectPath}/${folder.name}`
      deletePromises.push(deleteFolderRecursively(client, folderPath))
    }
  }

  await Promise.allSettled(deletePromises)

  return { error: null }
}

/**
 * Deletes a specific codebase version (by storage path prefix).
 * Defaults to admin client.
 */
export async function deleteCodebaseVersion(
  storagePath: string,
  supabase?: SupabaseClient
): Promise<{ error: Error | null }> {
  const client = supabase ?? createAdminClient()

  try {
    await deleteFolderRecursively(client, storagePath)
    return { error: null }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete codebase'
    console.error('[codebase.storage] Failed to delete codebase version:', storagePath, error)
    return { error: new Error(message) }
  }
}

/**
 * Helper to recursively delete all files in a folder
 */
async function deleteFolderRecursively(client: SupabaseClient, folderPath: string): Promise<void> {
  const { data: files, error: listError } = await client.storage
    .from(CODEBASE_BUCKET)
    .list(folderPath)

  if (listError) {
    console.error('[codebase.storage] Failed to list files for deletion:', folderPath, listError)
    return
  }

  if (!files || files.length === 0) {
    return
  }

  // Collect all file paths
  const filePaths: string[] = []
  const subFolders: string[] = []

  for (const item of files) {
    const itemPath = `${folderPath}/${item.name}`
    if (item.metadata) {
      // It's a file
      filePaths.push(itemPath)
    } else {
      // It's a folder, recurse
      subFolders.push(itemPath)
    }
  }

  // Delete files in this folder
  if (filePaths.length > 0) {
    const { error: deleteError } = await client.storage
      .from(CODEBASE_BUCKET)
      .remove(filePaths)

    if (deleteError) {
      console.error('[codebase.storage] Failed to delete files:', folderPath, deleteError)
    }
  }

  // Recurse into subfolders
  for (const subFolder of subFolders) {
    await deleteFolderRecursively(client, subFolder)
  }
}

/**
 * Ensures the codebase storage bucket exists (admin operation).
 * If service role key is not configured, this is a no-op (assumes bucket was pre-created).
 */
export async function ensureCodebaseBucket(): Promise<{ error: Error | null }> {
  // Skip if service role isn't configured - assume bucket was pre-created via Supabase dashboard
  if (!isServiceRoleConfigured()) {
    return { error: null }
  }

  try {
    const client = createAdminClient()

    const { error } = await client.storage.createBucket(CODEBASE_BUCKET, {
      public: false,
      fileSizeLimit: 100 * 1024 * 1024, // 100MB per file
    })

    if (error && !error.message.includes('already exists')) {
      console.error('[codebase.storage] Failed to create codebase bucket:', error)
      return { error: new Error(error.message) }
    }

    return { error: null }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to ensure codebase bucket'
    return { error: new Error(message) }
  }
}
