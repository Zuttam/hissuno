/**
 * Codebase service - business logic for codebase operations
 */

import ignore, { type Ignore } from 'ignore'
import { createClient } from '@/lib/supabase/server'
import { uploadCodebaseFile, deleteCodebaseVersion, getCodebaseBasePath, ensureCodebaseBucket } from './storage'
import type { CreateCodebaseParams, CreateCodebaseResult, CodebaseRecord } from './types'
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

/**
 * Creates a new codebase record from folder upload.
 * Uploads files to Supabase Storage and creates a database record.
 */
export async function createCodebase(
  params: CreateCodebaseParams
): Promise<CreateCodebaseResult> {
  const { files, gitignore, projectId, userId } = params

  if (!files || files.length === 0) {
    throw new Error('No files provided for folder upload.')
  }

  // Ensure storage bucket exists before uploading (best-effort, may fail if admin key not configured)
  await ensureCodebaseBucket()

  const supabase = await createClient()
  const timestamp = Date.now()
  const storagePath = getCodebaseBasePath(userId, projectId, timestamp)

  // Build gitignore matcher
  const matcher = await buildIgnoreMatcher(gitignore)

  // Filter and upload files
  const normalizedFiles = await normalizeAndFilterFiles(files, matcher)

  if (normalizedFiles.length === 0) {
    throw new Error('All files were ignored by .gitignore. Add files or adjust the rules.')
  }

  // Upload files in parallel (batched to avoid overwhelming the server)
  const batchSize = 10
  let uploadedCount = 0

  for (let i = 0; i < normalizedFiles.length; i += batchSize) {
    const batch = normalizedFiles.slice(i, i + batchSize)
    const uploadPromises = batch.map(({ file, relativePath }) =>
      uploadCodebaseFile(userId, projectId, file, relativePath, timestamp, supabase)
    )

    const results = await Promise.all(uploadPromises)

    for (const result of results) {
      if (result.error) {
        console.error('[codebase.service] File upload failed:', result.error)
        // Continue uploading other files
      } else {
        uploadedCount++
      }
    }
  }

  if (uploadedCount === 0) {
    throw new Error('Failed to upload any files.')
  }

  // Create the database record
  const { data: codebase, error: insertError } = await supabase
    .from('source_codes')
    .insert({
      kind: 'path',
      storage_uri: storagePath,
      user_id: userId,
    })
    .select()
    .single()

  if (insertError || !codebase) {
    console.error('[codebase.service] Failed to create codebase record:', insertError)
    // Attempt to clean up uploaded files
    await deleteCodebaseVersion(storagePath, supabase)
    throw new Error('Failed to create codebase record.')
  }

  return {
    codebase,
    storagePath,
    fileCount: uploadedCount,
  }
}

/**
 * Deletes a codebase record and its storage files.
 */
export async function deleteCodebase(
  supabase: SupabaseClient<Database>,
  codebaseId: string,
  userId: string
): Promise<void> {
  // Retrieve the codebase record to get storage location
  const { data: codebase, error: fetchError } = await supabase
    .from('source_codes')
    .select('*')
    .eq('id', codebaseId)
    .eq('user_id', userId)
    .single()

  if (fetchError || !codebase) {
    console.error('[codebase.service] Failed to fetch codebase:', codebaseId, fetchError)
    throw new Error('Codebase not found.')
  }

  // Delete the database record first
  const { error: deleteError } = await supabase
    .from('source_codes')
    .delete()
    .eq('id', codebaseId)
    .eq('user_id', userId)

  if (deleteError) {
    console.error('[codebase.service] Failed to delete codebase record:', codebaseId, deleteError)
    throw new Error('Failed to delete codebase.')
  }

  // Clean up storage (best-effort)
  if (codebase.storage_uri) {
    await deleteCodebaseVersion(codebase.storage_uri)
  }
}

/**
 * Gets a codebase record by ID, ensuring user ownership.
 */
export async function getCodebaseById(
  supabase: SupabaseClient<Database>,
  codebaseId: string,
  userId: string
): Promise<CodebaseRecord | null> {
  const { data, error } = await supabase
    .from('source_codes')
    .select('*')
    .eq('id', codebaseId)
    .eq('user_id', userId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return null
    }
    console.error('[codebase.service] Failed to get codebase:', codebaseId, error)
    throw new Error('Failed to get codebase.')
  }

  return data
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

interface NormalizedFile {
  file: File
  relativePath: string
}

async function normalizeAndFilterFiles(
  files: File[],
  matcher: Ignore | null
): Promise<NormalizedFile[]> {
  const result: NormalizedFile[] = []

  for (const file of files) {
    const relativePath = normalizeRelativePath(file.name)

    // Skip ignored files
    if (matcher && shouldIgnore(relativePath, matcher)) {
      continue
    }

    result.push({ file, relativePath })
  }

  return result
}

async function buildIgnoreMatcher(source: File | null): Promise<Ignore | null> {
  if (!source) return null

  const contents = await readFileAsText(source)
  if (!contents) return null

  const trimmed = contents.trim()
  if (!trimmed) return null

  return ignore().add(trimmed)
}

async function readFileAsText(file: File): Promise<string | null> {
  try {
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    return stripBom(buffer.toString('utf8'))
  } catch {
    return null
  }
}

function stripBom(value: string): string {
  return value.replace(/^\uFEFF/, '')
}

function shouldIgnore(relativePath: string, matcher: Ignore): boolean {
  return matcher.ignores(relativePath)
}

function normalizeRelativePath(name: string): string {
  // Remove leading slashes and normalize path separators
  const normalized = name.replace(/\\/g, '/').replace(/^\/+/, '')

  // Validate path doesn't escape
  if (normalized.startsWith('..') || normalized.includes('/../')) {
    throw new Error(`Invalid relative path: ${name}`)
  }

  return normalized
}
