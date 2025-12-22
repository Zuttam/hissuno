// ============================================================================
// FILE UTILITIES
// General-purpose utilities for working with File objects and file metadata
// ============================================================================

export type FileSummary = {
  name: string
  fileCount: number
  totalBytes: number
}

/**
 * Summarizes a collection of files by computing total size and extracting the root folder name.
 * Returns null if the files array is empty.
 */
export function summarizeFiles(files: File[]): FileSummary | null {
  if (files.length === 0) return null

  const first = files[0]
  const relativePath = getRelativePath(first)
  const name = relativePath.split('/')[0] || first.name
  const totalBytes = files.reduce((sum, file) => sum + file.size, 0)

  return {
    name,
    fileCount: files.length,
    totalBytes,
  }
}

/**
 * Formats a byte count into a human-readable string with appropriate units.
 */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'

  const kilo = 1024
  const suffixes = ['B', 'KB', 'MB', 'GB', 'TB']
  const index = Math.floor(Math.log(bytes) / Math.log(kilo))
  const value = bytes / Math.pow(kilo, index)

  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${suffixes[index]}`
}

/**
 * Extracts the relative path from a File object, using webkitRelativePath when available.
 * Normalizes the path by removing backslashes and leading "./".
 */
export function getRelativePath(file: File): string {
  const withRelative = file as File & { webkitRelativePath?: string }
  const raw =
    (withRelative.webkitRelativePath && withRelative.webkitRelativePath.length > 0
      ? withRelative.webkitRelativePath
      : file.name) || ''
  return raw.replace(/\\/g, '/').replace(/^\.\/+/g, '')
}

/**
 * Detects if all files share a common root folder.
 * Returns the root folder name if all files start with it, otherwise returns null.
 */
export function detectCommonRoot(files: File[]): string | null {
  if (files.length === 0) return null

  const firstSegments = getPathSegments(getRelativePath(files[0]))
  if (firstSegments.length === 0) return null
  const candidate = firstSegments[0]

  for (let index = 1; index < files.length; index += 1) {
    const segments = getPathSegments(getRelativePath(files[index]))
    if (segments.length === 0 || segments[0] !== candidate) {
      return null
    }
  }

  return candidate
}

/**
 * Splits a path into segments, filtering out empty strings.
 */
function getPathSegments(pathname: string): string[] {
  return pathname.split('/').filter(Boolean)
}

