import { describe, expect, it } from 'vitest'
import { detectCommonRoot, formatBytes, getRelativePath, summarizeFiles } from './files'

describe('file utilities', () => {
  it('normalizes relative paths using webkitRelativePath when available', () => {
    const file = new File(['content'], 'index.ts')
    Object.defineProperty(file, 'webkitRelativePath', {
      value: './src/index.ts',
      configurable: true,
    })

    expect(getRelativePath(file)).toBe('src/index.ts')
  })

  it('falls back to file name when webkitRelativePath is not available', () => {
    const file = new File(['content'], 'index.ts')
    expect(getRelativePath(file)).toBe('index.ts')
  })

  it('detects a shared top-level folder when all files include the same prefix', () => {
    const files = [
      createFile('workspace/app/src/index.ts'),
      createFile('workspace/app/src/app.tsx'),
      createFile('workspace/app/package.json'),
    ]

    expect(detectCommonRoot(files)).toBe('workspace')
  })

  it('returns null when files do not share a common root', () => {
    const files = [createFile('frontend/index.ts'), createFile('backend/server.ts')]

    expect(detectCommonRoot(files)).toBeNull()
  })

  it('returns null when given an empty array', () => {
    expect(detectCommonRoot([])).toBeNull()
  })

  it('formats bytes into human-readable strings', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(1048576)).toBe('1 MB')
    expect(formatBytes(1073741824)).toBe('1 GB')
  })

  it('summarizes files by computing count and total size', () => {
    const files = [
      createFile('workspace/src/index.ts', 'a'.repeat(100)),
      createFile('workspace/src/app.tsx', 'b'.repeat(200)),
      createFile('workspace/README.md', 'c'.repeat(50)),
    ]

    const summary = summarizeFiles(files)
    expect(summary).not.toBeNull()
    expect(summary?.name).toBe('workspace')
    expect(summary?.fileCount).toBe(3)
    expect(summary?.totalBytes).toBe(350)
  })

  it('returns null when summarizing an empty file list', () => {
    expect(summarizeFiles([])).toBeNull()
  })
})

function createFile(relativePath: string, contents = '') {
  const file = new File([contents], relativePath.split('/').pop() ?? relativePath)
  Object.defineProperty(file, 'webkitRelativePath', {
    value: relativePath,
    configurable: true,
  })
  return file
}

