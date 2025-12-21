// ============================================================================
// SOURCE CODE UTILITIES (Client-Safe)
// Utilities for working with source code files in the browser
// ============================================================================

import ignore, { type Ignore } from 'ignore'
import { getRelativePath, detectCommonRoot } from '@/lib/utils/files'

// Re-export file utilities for convenience
export { summarizeFiles, formatBytes, type FileSummary } from '@/lib/utils/files'

// ============================================================================
// TYPES
// ============================================================================

export type GitignoreSelectionSource = 'explicit' | 'auto'

export type GitignoreSelection = {
  file: File
  relativePath: string
  source: GitignoreSelectionSource
}

export type UploadEntry = {
  file: File
  relativePath: string
}

export type FilterFilesResult = {
  kept: UploadEntry[]
  ignored: string[]
}

// ============================================================================
// GITIGNORE SELECTION
// ============================================================================

/**
 * Finds the best .gitignore candidate from a list of files.
 * Prefers files closer to the root (fewer path segments).
 */
export function findGitignoreCandidate(files: File[]): GitignoreSelection | null {
  let best: { file: File; relativePath: string; depth: number } | null = null

  for (const file of files) {
    const relativePath = getRelativePath(file)
    if (!relativePath.toLowerCase().endsWith('.gitignore')) {
      continue
    }

    const depth = relativePath.split('/').length
    if (!best || depth < best.depth) {
      best = { file, relativePath, depth }
    }
  }

  if (!best) return null
  return { file: best.file, relativePath: best.relativePath, source: 'auto' }
}

/**
 * Selects a gitignore file, preferring an explicit selection over auto-detection.
 */
export function selectGitignore(
  files: File[],
  explicit?: File | null
): GitignoreSelection | null {
  const explicitFile = explicit && explicit.size > 0 ? explicit : null
  if (explicitFile) {
    return {
      file: explicitFile,
      relativePath: getRelativePath(explicitFile) || '.gitignore',
      source: 'explicit',
    }
  }

  return findGitignoreCandidate(files)
}

// ============================================================================
// FILE FILTERING
// ============================================================================

/**
 * Filters files for upload based on gitignore rules.
 * Returns kept files and list of ignored paths.
 */
export async function filterFilesForUpload(
  files: File[],
  gitignore: GitignoreSelection | null
): Promise<FilterFilesResult> {
  if (files.length === 0) {
    return { kept: [], ignored: [] }
  }

  const matcher = await buildIgnoreMatcher(gitignore?.file)
  const root = detectCommonRoot(files)

  const kept: UploadEntry[] = []
  const ignored: string[] = []
  const gitignoreFile = gitignore?.file ?? null
  const includeExplicitGitignore = gitignoreFile && !files.includes(gitignoreFile)

  for (const file of files) {
    const relativePath = getRelativePath(file)
    const uploadPath = normalizeUploadPath(relativePath, root)
    const normalizedPath = uploadPath || relativePath
    const isGitignoreFile = gitignoreFile ? file === gitignoreFile : false

    if (matcher && !isGitignoreFile) {
      const matchPath = normalizedPath
      if (matchPath && matcher.ignores(matchPath)) {
        ignored.push(relativePath)
        continue
      }
    }

    kept.push({ file, relativePath: normalizedPath })
  }

  if (includeExplicitGitignore && gitignoreFile) {
    const uploadPath = normalizeUploadPath(gitignore?.relativePath ?? gitignoreFile.name, root)
    const normalizedPath = uploadPath || gitignore?.relativePath || gitignoreFile.name
    kept.push({ file: gitignoreFile, relativePath: normalizedPath })
  }

  return { kept, ignored }
}

// ============================================================================
// INTERNAL HELPERS
// ============================================================================

async function buildIgnoreMatcher(source?: File | null): Promise<Ignore | null> {
  const contents = await readGitignore(source)
  if (!contents) return null
  const trimmed = contents.trim()
  if (!trimmed) return null
  return ignore().add(trimmed)
}

async function readGitignore(source?: File | null): Promise<string | null> {
  if (!source) return null
  const arrayBuffer = await source.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)
  return stripBom(buffer.toString('utf8'))
}

function stripBom(value: string) {
  return value.replace(/^\uFEFF/, '')
}

function normalizeUploadPath(relativePath: string, root: string | null): string {
  const sanitized = relativePath.replace(/^\/+/g, '')
  if (!root) return sanitized
  if (sanitized === root) return sanitized
  if (sanitized.startsWith(`${root}/`)) {
    return sanitized.slice(root.length + 1)
  }
  return sanitized
}

