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

