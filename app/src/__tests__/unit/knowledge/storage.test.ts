/**
 * Unit Tests for Knowledge Storage Utilities
 *
 * Tests file validation (size limits, extension checks, magic bytes)
 * and storage path generation. Uses mock File objects.
 */

import { describe, it, expect } from 'vitest'
import { validateUploadedFile, getDocumentPath } from '@/lib/knowledge/storage'

// ============================================================================
// Helpers
// ============================================================================

function createMockFile(
  name: string,
  content: Uint8Array | string,
  options: { type?: string } = {}
): File {
  const data = typeof content === 'string' ? new TextEncoder().encode(content) : content
  const blob = new Blob([data as BlobPart], { type: options.type })
  return new File([blob], name, { type: options.type })
}

// Magic bytes for common file types
const PDF_MAGIC = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])
const DOCX_MAGIC = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x00, 0x00, 0x00, 0x00])
const DOC_MAGIC = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])

// ============================================================================
// validateUploadedFile
// ============================================================================

describe('validateUploadedFile', () => {
  describe('file size validation', () => {
    it('rejects files over 10MB', async () => {
      const bigContent = new Uint8Array(11 * 1024 * 1024) // 11MB
      const file = createMockFile('big.txt', bigContent, { type: 'text/plain' })
      const error = await validateUploadedFile(file)
      expect(error).toContain('exceeds the 10MB limit')
    })

    it('accepts files under 10MB', async () => {
      const content = 'Valid text content for testing.'
      const file = createMockFile('small.txt', content, { type: 'text/plain' })
      const error = await validateUploadedFile(file)
      expect(error).toBeNull()
    })

    it('rejects empty files', async () => {
      const file = createMockFile('empty.txt', new Uint8Array(0), { type: 'text/plain' })
      const error = await validateUploadedFile(file)
      expect(error).toBe('File is empty.')
    })
  })

  describe('file type validation', () => {
    it('accepts .pdf files with correct MIME type', async () => {
      const file = createMockFile('document.pdf', PDF_MAGIC, { type: 'application/pdf' })
      const error = await validateUploadedFile(file)
      expect(error).toBeNull()
    })

    it('accepts .txt files with correct MIME type', async () => {
      const file = createMockFile('notes.txt', 'Hello world content', { type: 'text/plain' })
      const error = await validateUploadedFile(file)
      expect(error).toBeNull()
    })

    it('accepts .md files with text/markdown MIME', async () => {
      const file = createMockFile('readme.md', '# Heading\n\nContent', { type: 'text/markdown' })
      const error = await validateUploadedFile(file)
      expect(error).toBeNull()
    })

    it('accepts .md files with text/plain MIME', async () => {
      const file = createMockFile('readme.md', '# Heading\n\nContent', { type: 'text/plain' })
      const error = await validateUploadedFile(file)
      expect(error).toBeNull()
    })

    it('accepts .docx files with correct magic bytes', async () => {
      const file = createMockFile(
        'doc.docx',
        DOCX_MAGIC,
        { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
      )
      const error = await validateUploadedFile(file)
      expect(error).toBeNull()
    })

    it('accepts .doc files with correct magic bytes', async () => {
      const file = createMockFile('doc.doc', DOC_MAGIC, { type: 'application/msword' })
      const error = await validateUploadedFile(file)
      expect(error).toBeNull()
    })

    it('rejects disallowed file extensions', async () => {
      const file = createMockFile('script.js', 'console.log("hi")', { type: 'application/javascript' })
      const error = await validateUploadedFile(file)
      expect(error).toContain('not allowed')
      expect(error).toContain('.js')
    })

    it('rejects .exe files', async () => {
      const file = createMockFile('program.exe', new Uint8Array(100), { type: 'application/x-executable' })
      const error = await validateUploadedFile(file)
      expect(error).toContain('not allowed')
    })

    it('rejects mismatched MIME type for .pdf', async () => {
      const file = createMockFile('fake.pdf', PDF_MAGIC, { type: 'text/plain' })
      const error = await validateUploadedFile(file)
      expect(error).toContain('MIME type')
      expect(error).toContain('does not match')
    })
  })

  describe('magic byte verification', () => {
    it('rejects .pdf with wrong magic bytes', async () => {
      const wrongBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07])
      const file = createMockFile('bad.pdf', wrongBytes, { type: 'application/pdf' })
      const error = await validateUploadedFile(file)
      expect(error).toContain('invalid file signature')
    })

    it('rejects .docx with wrong magic bytes', async () => {
      const wrongBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07])
      const file = createMockFile(
        'bad.docx',
        wrongBytes,
        { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }
      )
      const error = await validateUploadedFile(file)
      expect(error).toContain('invalid file signature')
    })

    it('rejects text files containing binary content', async () => {
      const binaryContent = new Uint8Array([0x00, 0x01, 0x02, 0x48, 0x65, 0x6c, 0x6c, 0x6f])
      const file = createMockFile('fake.txt', binaryContent, { type: 'text/plain' })
      const error = await validateUploadedFile(file)
      expect(error).toContain('binary content')
    })
  })

  describe('file without extension', () => {
    it('rejects files without extension', async () => {
      const file = createMockFile('noext', 'hello', { type: 'text/plain' })
      const error = await validateUploadedFile(file)
      expect(error).toContain('not allowed')
    })
  })
})

// ============================================================================
// getDocumentPath
// ============================================================================

describe('getDocumentPath', () => {
  it('generates path with project ID prefix', () => {
    const path = getDocumentPath('proj-123', 'report.pdf')
    expect(path).toMatch(/^proj-123\/docs\//)
  })

  it('includes timestamp in path', () => {
    const before = Date.now()
    const path = getDocumentPath('proj-1', 'file.txt')
    const after = Date.now()

    const parts = path.split('/')
    const filename = parts[parts.length - 1]
    const timestamp = parseInt(filename.split('-')[0], 10)
    expect(timestamp).toBeGreaterThanOrEqual(before)
    expect(timestamp).toBeLessThanOrEqual(after)
  })

  it('sanitizes special characters in filename', () => {
    const path = getDocumentPath('proj-1', 'my file (1).pdf')
    expect(path).not.toContain(' ')
    expect(path).not.toContain('(')
    expect(path).not.toContain(')')
    expect(path).toContain('my_file__1_.pdf')
  })

  it('preserves dots and hyphens in filename', () => {
    const path = getDocumentPath('proj-1', 'my-file.v2.pdf')
    expect(path).toContain('my-file.v2.pdf')
  })
})
