/**
 * Codebase service - business logic for codebase operations
 */

import ignore, { type Ignore } from 'ignore'
import { Readable } from 'stream'
import * as tar from 'tar-stream'
import { createGunzip } from 'zlib'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { uploadCodebaseFile, uploadCodebaseBuffer, deleteCodebaseVersion, getCodebaseBasePath, ensureCodebaseBucket } from './storage'
import { getGitHubToken, getLatestCommitSha, downloadRepoTarball, parseGitHubRepoUrl } from '@/lib/integrations/github'
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

/**
 * Creates a codebase record for a GitHub repository.
 * No file upload needed - just stores the repository URL and branch.
 */
export async function createGitHubCodebase(params: {
  repositoryUrl: string
  repositoryBranch: string
  userId: string
}): Promise<{ codebase: CodebaseRecord }> {
  const { repositoryUrl, repositoryBranch, userId } = params

  const supabase = await createClient()

  const { data: codebase, error: insertError } = await supabase
    .from('source_codes')
    .insert({
      kind: 'github',
      repository_url: repositoryUrl,
      repository_branch: repositoryBranch,
      user_id: userId,
    })
    .select()
    .single()

  if (insertError || !codebase) {
    console.error('[codebase.service] Failed to create GitHub codebase record:', insertError)
    throw new Error('Failed to create GitHub codebase record.')
  }

  return { codebase }
}

/**
 * Updates a GitHub codebase record with new repository URL and/or branch.
 */
export async function updateGitHubCodebase(
  supabase: SupabaseClient<Database>,
  codebaseId: string,
  userId: string,
  updates: { repositoryUrl?: string; repositoryBranch?: string }
): Promise<CodebaseRecord> {
  const updateData: Record<string, string> = {}
  
  if (updates.repositoryUrl) {
    updateData.repository_url = updates.repositoryUrl
  }
  if (updates.repositoryBranch) {
    updateData.repository_branch = updates.repositoryBranch
  }

  if (Object.keys(updateData).length === 0) {
    throw new Error('No updates provided.')
  }

  const { data, error } = await supabase
    .from('source_codes')
    .update(updateData)
    .eq('id', codebaseId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error || !data) {
    console.error('[codebase.service] Failed to update GitHub codebase:', codebaseId, error)
    throw new Error('Failed to update GitHub codebase.')
  }

  return data
}

export type SyncGitHubCodebaseResult = {
  status: 'synced' | 'already_up_to_date' | 'error'
  commitSha?: string
  fileCount?: number
  error?: string
}

/**
 * Syncs a GitHub codebase by downloading the repository and storing it in Supabase Storage.
 * Checks the commit SHA to skip sync if already up-to-date.
 */
export async function syncGitHubCodebase(params: {
  codebaseId: string
  userId: string
  projectId: string
}): Promise<SyncGitHubCodebaseResult> {
  const { codebaseId, userId, projectId } = params

  const supabase = createAdminClient()

  // 1. Fetch the source_code record
  const { data: codebase, error: fetchError } = await supabase
    .from('source_codes')
    .select('*')
    .eq('id', codebaseId)
    .single()

  if (fetchError || !codebase) {
    console.error('[codebase.sync] Failed to fetch codebase:', codebaseId, fetchError)
    return { status: 'error', error: 'Codebase not found.' }
  }

  if (codebase.kind !== 'github') {
    return { status: 'error', error: 'Codebase is not a GitHub source.' }
  }

  if (!codebase.repository_url || !codebase.repository_branch) {
    return { status: 'error', error: 'Missing repository URL or branch.' }
  }

  // 2. Get the user's GitHub token
  const token = await getGitHubToken(supabase, userId)
  if (!token) {
    return { status: 'error', error: 'GitHub integration not connected.' }
  }

  // 3. Parse repository URL
  const parsed = parseGitHubRepoUrl(codebase.repository_url)
  if (!parsed) {
    return { status: 'error', error: 'Invalid repository URL.' }
  }

  const { owner, repo } = parsed
  const branch = codebase.repository_branch

  try {
    // 4. Get the latest commit SHA
    const latestSha = await getLatestCommitSha(token, owner, repo, branch)

    // 5. Check if already synced with this SHA
    if (codebase.commit_sha === latestSha && codebase.storage_uri) {
      console.log('[codebase.sync] Already up to date:', latestSha)
      return { status: 'already_up_to_date', commitSha: latestSha }
    }

    // 6. Download the tarball
    console.log('[codebase.sync] Downloading tarball for', owner, repo, branch)
    const tarballBuffer = await downloadRepoTarball(token, owner, repo, branch)

    // 7. Ensure bucket exists
    await ensureCodebaseBucket()

    // 8. Extract and upload files
    const timestamp = Date.now()
    const storagePath = getCodebaseBasePath(userId, projectId, timestamp)

    const fileCount = await extractAndUploadTarball(
      Buffer.from(tarballBuffer),
      storagePath,
      supabase
    )

    if (fileCount === 0) {
      return { status: 'error', error: 'No files extracted from repository.' }
    }

    // 9. Clean up old version if exists
    if (codebase.storage_uri && codebase.storage_uri !== storagePath) {
      await deleteCodebaseVersion(codebase.storage_uri, supabase)
    }

    // 10. Update the database record
    const { error: updateError } = await supabase
      .from('source_codes')
      .update({
        storage_uri: storagePath,
        commit_sha: latestSha,
        synced_at: new Date().toISOString(),
      })
      .eq('id', codebaseId)

    if (updateError) {
      console.error('[codebase.sync] Failed to update codebase record:', updateError)
      return { status: 'error', error: 'Failed to update codebase record.' }
    }

    console.log('[codebase.sync] Synced successfully:', latestSha, fileCount, 'files')
    return { status: 'synced', commitSha: latestSha, fileCount }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[codebase.sync] Error syncing codebase:', message)
    return { status: 'error', error: message }
  }
}

/**
 * Extracts a gzipped tarball and uploads files to Supabase Storage.
 * Returns the number of files uploaded.
 */
async function extractAndUploadTarball(
  tarballBuffer: Buffer,
  storagePath: string,
  supabase: SupabaseClient
): Promise<number> {
  return new Promise((resolve, reject) => {
    const extract = tar.extract()
    const uploadPromises: Promise<{ error: Error | null }>[] = []
    let fileCount = 0

    // Text file extensions for proper content type
    const textExtensions = new Set([
      '.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.mdx',
      '.yaml', '.yml', '.toml', '.css', '.scss', '.html',
      '.xml', '.svg', '.txt', '.sh', '.py', '.rb', '.go',
      '.rs', '.java', '.kt', '.swift', '.c', '.cpp', '.h',
      '.sql', '.graphql', '.prisma', '.env', '.gitignore',
    ])

    extract.on('entry', (header, stream, next) => {
      const chunks: Buffer[] = []

      stream.on('data', (chunk: Buffer) => {
        chunks.push(chunk)
      })

      stream.on('end', () => {
        if (header.type === 'file' && header.name) {
          // GitHub tarball includes a root folder like "owner-repo-sha/"
          // We need to remove this prefix
          const pathParts = header.name.split('/')
          if (pathParts.length > 1) {
            // Skip the first part (root folder)
            const relativePath = pathParts.slice(1).join('/')
            
            if (relativePath && !shouldSkipFile(relativePath)) {
              const buffer = Buffer.concat(chunks)
              const ext = getFileExtension(relativePath)
              const contentType = textExtensions.has(ext) 
                ? 'text/plain; charset=utf-8' 
                : 'application/octet-stream'

              const fullPath = `${storagePath}/${relativePath}`
              uploadPromises.push(
                uploadCodebaseBuffer(fullPath, new Uint8Array(buffer), contentType, supabase)
              )
              fileCount++
            }
          }
        }
        next()
      })

      stream.on('error', (err: Error) => {
        console.error('[codebase.sync] Stream error:', err)
        next()
      })

      stream.resume()
    })

    extract.on('finish', async () => {
      try {
        const results = await Promise.all(uploadPromises)
        const errors = results.filter(r => r.error)
        if (errors.length > 0) {
          console.warn('[codebase.sync] Some files failed to upload:', errors.length)
        }
        resolve(fileCount - errors.length)
      } catch (err) {
        reject(err)
      }
    })

    extract.on('error', (err: Error) => {
      console.error('[codebase.sync] Extract error:', err)
      reject(err)
    })

    // Create a readable stream from the buffer and pipe through gunzip
    const readable = Readable.from(tarballBuffer)
    const gunzip = createGunzip()

    gunzip.on('error', (err: Error) => {
      console.error('[codebase.sync] Gunzip error:', err)
      reject(err)
    })

    readable.pipe(gunzip).pipe(extract)
  })
}

/**
 * Determines if a file should be skipped during extraction.
 */
function shouldSkipFile(relativePath: string): boolean {
  // Skip hidden files and directories
  const parts = relativePath.split('/')
  for (const part of parts) {
    if (part.startsWith('.') && part !== '.gitignore' && part !== '.env.example') {
      return true
    }
  }

  // Skip common non-essential directories
  const skipDirs = ['node_modules', '.git', '__pycache__', 'dist', 'build', '.next']
  for (const dir of skipDirs) {
    if (relativePath.startsWith(dir + '/') || relativePath.includes('/' + dir + '/')) {
      return true
    }
  }

  // Skip binary files and large assets
  const skipExtensions = ['.exe', '.dll', '.so', '.dylib', '.zip', '.tar', '.gz', '.rar', '.7z']
  const ext = getFileExtension(relativePath)
  if (skipExtensions.includes(ext)) {
    return true
  }

  return false
}

function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  if (lastDot === -1) return ''
  return filename.slice(lastDot).toLowerCase()
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
