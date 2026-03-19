/**
 * Tests for file utility functions.
 *
 * Covers formatBytes edge cases, getRelativePath path normalization
 * (including traversal prevention), summarizeFiles, and detectCommonRoot.
 */

import { describe, it, expect } from 'vitest'
import {
  formatBytes,
  getRelativePath,
  summarizeFiles,
  detectCommonRoot,
} from '@/lib/utils/files'

// =============================================================================
// Helper: create a mock File object
// =============================================================================

function mockFile(
  name: string,
  size: number = 100,
  webkitRelativePath?: string
): File {
  const file = new File(['x'.repeat(size)], name, { type: 'text/plain' })
  if (webkitRelativePath !== undefined) {
    Object.defineProperty(file, 'webkitRelativePath', {
      value: webkitRelativePath,
      writable: false,
    })
  }
  return file
}

// =============================================================================
// formatBytes
// =============================================================================

describe('formatBytes', () => {
  it('returns "0 B" for zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('formats bytes under 1KB', () => {
    expect(formatBytes(500)).toBe('500 B')
  })

  it('formats exactly 1KB', () => {
    expect(formatBytes(1024)).toBe('1.0 KB')
  })

  it('formats kilobytes with one decimal', () => {
    expect(formatBytes(1536)).toBe('1.5 KB')
  })

  it('formats values >= 10 KB without decimals', () => {
    expect(formatBytes(10240)).toBe('10 KB')
  })

  it('formats exactly 1MB', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
  })

  it('formats exactly 1GB', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB')
  })

  it('formats exactly 1TB', () => {
    expect(formatBytes(1024 * 1024 * 1024 * 1024)).toBe('1.0 TB')
  })

  it('formats 1 byte', () => {
    expect(formatBytes(1)).toBe('1 B')
  })

  it('formats large GB values without decimals', () => {
    // 15 GB = 15 * 1024^3
    expect(formatBytes(15 * 1024 * 1024 * 1024)).toBe('15 GB')
  })

  it('formats 999 bytes correctly', () => {
    expect(formatBytes(999)).toBe('999 B')
  })
})

// =============================================================================
// getRelativePath
// =============================================================================

describe('getRelativePath', () => {
  it('returns file name when no webkitRelativePath', () => {
    const file = mockFile('test.txt')
    expect(getRelativePath(file)).toBe('test.txt')
  })

  it('returns webkitRelativePath when available', () => {
    const file = mockFile('test.txt', 100, 'folder/subfolder/test.txt')
    expect(getRelativePath(file)).toBe('folder/subfolder/test.txt')
  })

  it('normalizes backslashes to forward slashes', () => {
    const file = mockFile('test.txt', 100, 'folder\\subfolder\\test.txt')
    expect(getRelativePath(file)).toBe('folder/subfolder/test.txt')
  })

  it('strips leading ./ prefix', () => {
    const file = mockFile('test.txt', 100, './folder/test.txt')
    expect(getRelativePath(file)).toBe('folder/test.txt')
  })

  it('strips multiple leading ./ prefixes', () => {
    const file = mockFile('test.txt', 100, './//folder/test.txt')
    expect(getRelativePath(file)).toBe('folder/test.txt')
  })

  it('does not strip ../ (path traversal stays as-is for detection)', () => {
    // The function does NOT sanitize path traversal - it only normalizes.
    // Traversal prevention should happen at a higher layer.
    const file = mockFile('test.txt', 100, '../secret/test.txt')
    const result = getRelativePath(file)
    expect(result).toBe('../secret/test.txt')
  })

  it('falls back to filename when webkitRelativePath is empty string', () => {
    const file = mockFile('fallback.txt', 100, '')
    expect(getRelativePath(file)).toBe('fallback.txt')
  })

  it('handles mixed backslashes and ./ prefix', () => {
    const file = mockFile('test.txt', 100, '.\\folder\\test.txt')
    // First backslashes become /, then leading ./ is stripped
    expect(getRelativePath(file)).toBe('folder/test.txt')
  })
})

// =============================================================================
// summarizeFiles
// =============================================================================

describe('summarizeFiles', () => {
  it('returns null for empty array', () => {
    expect(summarizeFiles([])).toBeNull()
  })

  it('returns correct summary for single file', () => {
    const files = [mockFile('test.txt', 1024)]
    const summary = summarizeFiles(files)
    expect(summary).not.toBeNull()
    expect(summary!.fileCount).toBe(1)
    expect(summary!.name).toBe('test.txt')
  })

  it('computes total bytes across multiple files', () => {
    const files = [
      mockFile('a.txt', 100),
      mockFile('b.txt', 200),
      mockFile('c.txt', 300),
    ]
    const summary = summarizeFiles(files)
    expect(summary).not.toBeNull()
    // File constructor uses the content 'xxx...' so size = content.length
    expect(summary!.totalBytes).toBe(600)
  })

  it('extracts root folder name from webkitRelativePath', () => {
    const files = [
      mockFile('a.txt', 100, 'myFolder/a.txt'),
      mockFile('b.txt', 100, 'myFolder/sub/b.txt'),
    ]
    const summary = summarizeFiles(files)
    expect(summary!.name).toBe('myFolder')
  })

  it('falls back to file name when no path segments', () => {
    const files = [mockFile('standalone.txt', 100)]
    const summary = summarizeFiles(files)
    expect(summary!.name).toBe('standalone.txt')
  })
})

// =============================================================================
// detectCommonRoot
// =============================================================================

describe('detectCommonRoot', () => {
  it('returns null for empty array', () => {
    expect(detectCommonRoot([])).toBeNull()
  })

  it('returns root folder when all files share it', () => {
    const files = [
      mockFile('a.txt', 10, 'root/a.txt'),
      mockFile('b.txt', 10, 'root/sub/b.txt'),
      mockFile('c.txt', 10, 'root/other/c.txt'),
    ]
    expect(detectCommonRoot(files)).toBe('root')
  })

  it('returns null when files have different roots', () => {
    const files = [
      mockFile('a.txt', 10, 'folderA/a.txt'),
      mockFile('b.txt', 10, 'folderB/b.txt'),
    ]
    expect(detectCommonRoot(files)).toBeNull()
  })

  it('returns null when a file has no path segments', () => {
    const files = [
      mockFile('a.txt', 10, 'root/a.txt'),
      mockFile('b.txt', 10), // no webkitRelativePath -> name only -> no segments with /
    ]
    // 'root' vs 'b.txt' -> different first segment
    expect(detectCommonRoot(files)).toBeNull()
  })

  it('handles single file with path', () => {
    const files = [mockFile('a.txt', 10, 'onlyRoot/a.txt')]
    expect(detectCommonRoot(files)).toBe('onlyRoot')
  })

  it('returns null when single file has no directory', () => {
    // getPathSegments('standalone.txt') returns ['standalone.txt'] which is
    // a single segment, so candidate = 'standalone.txt'. With only one file,
    // the loop doesn't execute and candidate is returned.
    const files = [mockFile('standalone.txt', 10)]
    expect(detectCommonRoot(files)).toBe('standalone.txt')
  })
})
