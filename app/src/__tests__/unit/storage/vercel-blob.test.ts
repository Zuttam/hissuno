import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockPut, mockDel, mockGet, mockFetch } = vi.hoisted(() => ({
  mockPut: vi.fn(),
  mockDel: vi.fn(),
  mockGet: vi.fn(),
  mockFetch: vi.fn(),
}))

vi.mock('@vercel/blob', () => ({
  put: mockPut,
  del: mockDel,
  get: mockGet,
}))

vi.stubGlobal('fetch', mockFetch)

import { VercelBlobStorageProvider } from '@/lib/storage/vercel-blob'

const VALID_TOKEN = 'vercel_blob_rw_abc123def_randomsuffix'
const EXPECTED_PRIVATE_URL = 'https://abc123def.private.blob.vercel-storage.com'
const EXPECTED_PUBLIC_URL = 'https://abc123def.public.blob.vercel-storage.com'

describe('VercelBlobStorageProvider', () => {
  let originalEnv: NodeJS.ProcessEnv

  beforeEach(() => {
    originalEnv = { ...process.env }
    vi.clearAllMocks()
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('constructor', () => {
    it('throws when BLOB_READ_WRITE_TOKEN is missing', () => {
      delete process.env.BLOB_READ_WRITE_TOKEN
      expect(() => new VercelBlobStorageProvider()).toThrow('BLOB_READ_WRITE_TOKEN is required')
    })

    it('derives store URL from token', () => {
      process.env.BLOB_READ_WRITE_TOKEN = VALID_TOKEN
      const provider = new VercelBlobStorageProvider()
      expect(provider).toBeDefined()
    })

    it('throws when token format is unrecognized', () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'invalid_token_format'
      expect(() => new VercelBlobStorageProvider()).toThrow('Could not derive store URL')
    })

    it('uses BLOB_STORE_URL when provided', () => {
      process.env.BLOB_READ_WRITE_TOKEN = 'invalid_token_format'
      process.env.BLOB_STORE_URL = 'https://custom.blob.store.com/'
      const provider = new VercelBlobStorageProvider()
      expect(provider).toBeDefined()
    })
  })

  describe('upload (private - default)', () => {
    let provider: VercelBlobStorageProvider

    beforeEach(() => {
      process.env.BLOB_READ_WRITE_TOKEN = VALID_TOKEN
      delete process.env.BLOB_ACCESS
      provider = new VercelBlobStorageProvider()
    })

    it('uploads with private access by default', async () => {
      mockPut.mockResolvedValue({ url: `${EXPECTED_PRIVATE_URL}/docs/file.txt` })

      const result = await provider.upload('docs', 'file.txt', 'hello world', {
        contentType: 'text/plain',
      })

      expect(result).toEqual({ path: 'file.txt', error: null })
      expect(mockPut).toHaveBeenCalledWith(
        'docs/file.txt',
        'hello world',
        { access: 'private', contentType: 'text/plain', addRandomSuffix: false }
      )
    })

    it('uploads Uint8Array data', async () => {
      mockPut.mockResolvedValue({ url: `${EXPECTED_PRIVATE_URL}/docs/data.bin` })

      const data = new Uint8Array([1, 2, 3])
      const result = await provider.upload('docs', 'data.bin', data)

      expect(result).toEqual({ path: 'data.bin', error: null })
      expect(mockPut).toHaveBeenCalledWith(
        'docs/data.bin',
        expect.any(Buffer),
        { access: 'private', contentType: 'application/octet-stream', addRandomSuffix: false }
      )
    })

    it('returns error on failure', async () => {
      mockPut.mockRejectedValue(new Error('Network error'))

      const result = await provider.upload('docs', 'file.txt', 'data')

      expect(result.path).toBe('file.txt')
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error!.message).toBe('Network error')
    })
  })

  describe('upload (public)', () => {
    let provider: VercelBlobStorageProvider

    beforeEach(() => {
      process.env.BLOB_READ_WRITE_TOKEN = VALID_TOKEN
      process.env.BLOB_ACCESS = 'public'
      provider = new VercelBlobStorageProvider()
    })

    it('uploads with public access when BLOB_ACCESS=public', async () => {
      mockPut.mockResolvedValue({ url: `${EXPECTED_PUBLIC_URL}/docs/file.txt` })

      const result = await provider.upload('docs', 'file.txt', 'hello world', {
        contentType: 'text/plain',
      })

      expect(result).toEqual({ path: 'file.txt', error: null })
      expect(mockPut).toHaveBeenCalledWith(
        'docs/file.txt',
        'hello world',
        { access: 'public', contentType: 'text/plain', addRandomSuffix: false }
      )
    })
  })

  describe('download (private - default)', () => {
    let provider: VercelBlobStorageProvider

    beforeEach(() => {
      process.env.BLOB_READ_WRITE_TOKEN = VALID_TOKEN
      delete process.env.BLOB_ACCESS
      provider = new VercelBlobStorageProvider()
    })

    it('uses get() from SDK for private stores', async () => {
      const content = new TextEncoder().encode('file content')
      const stream = new ReadableStream({
        start(controller) { controller.enqueue(content); controller.close() }
      })
      mockGet.mockResolvedValue({ statusCode: 200, stream, blob: {} })

      const result = await provider.download('docs', 'file.txt')

      expect(result.data).toBeInstanceOf(Blob)
      expect(result.error).toBeNull()
      expect(mockGet).toHaveBeenCalledWith(`${EXPECTED_PRIVATE_URL}/docs/file.txt`, { access: 'private' })
    })

    it('returns error when blob not found', async () => {
      mockGet.mockResolvedValue(null)

      const result = await provider.download('docs', 'missing.txt')

      expect(result.data).toBeNull()
      expect(result.error!.message).toContain('not found')
    })

    it('returns error on get failure', async () => {
      mockGet.mockRejectedValue(new Error('Connection refused'))

      const result = await provider.download('docs', 'file.txt')

      expect(result.data).toBeNull()
      expect(result.error!.message).toBe('Connection refused')
    })
  })

  describe('download (public)', () => {
    let provider: VercelBlobStorageProvider

    beforeEach(() => {
      process.env.BLOB_READ_WRITE_TOKEN = VALID_TOKEN
      process.env.BLOB_ACCESS = 'public'
      provider = new VercelBlobStorageProvider()
    })

    it('uses get() with public access', async () => {
      const content = new TextEncoder().encode('file content')
      const stream = new ReadableStream({
        start(controller) { controller.enqueue(content); controller.close() }
      })
      mockGet.mockResolvedValue({ statusCode: 200, stream, blob: {} })

      const result = await provider.download('docs', 'file.txt')

      expect(result.data).toBeInstanceOf(Blob)
      expect(result.error).toBeNull()
      expect(mockGet).toHaveBeenCalledWith(`${EXPECTED_PUBLIC_URL}/docs/file.txt`, { access: 'public' })
    })
  })

  describe('downloadText (private - default)', () => {
    let provider: VercelBlobStorageProvider

    beforeEach(() => {
      process.env.BLOB_READ_WRITE_TOKEN = VALID_TOKEN
      delete process.env.BLOB_ACCESS
      provider = new VercelBlobStorageProvider()
    })

    it('uses get() and decodes text for private stores', async () => {
      const content = new TextEncoder().encode('hello')
      const stream = new ReadableStream({
        start(controller) { controller.enqueue(content); controller.close() }
      })
      mockGet.mockResolvedValue({ statusCode: 200, stream, blob: {} })

      const result = await provider.downloadText('docs', 'file.txt')

      expect(result).toEqual({ content: 'hello', error: null })
      expect(mockGet).toHaveBeenCalledWith(`${EXPECTED_PRIVATE_URL}/docs/file.txt`, { access: 'private' })
    })

    it('returns error when blob not found', async () => {
      mockGet.mockResolvedValue(null)

      const result = await provider.downloadText('docs', 'file.txt')

      expect(result.content).toBeNull()
      expect(result.error!.message).toContain('not found')
    })
  })

  describe('delete', () => {
    let provider: VercelBlobStorageProvider

    beforeEach(() => {
      process.env.BLOB_READ_WRITE_TOKEN = VALID_TOKEN
      provider = new VercelBlobStorageProvider()
    })

    it('deletes files by constructing full URLs', async () => {
      mockDel.mockResolvedValue(undefined)

      const result = await provider.delete('docs', ['a.txt', 'b.txt'])

      expect(result).toEqual({ error: null })
      expect(mockDel).toHaveBeenCalledWith([
        `${EXPECTED_PRIVATE_URL}/docs/a.txt`,
        `${EXPECTED_PRIVATE_URL}/docs/b.txt`,
      ])
    })

    it('handles empty paths array', async () => {
      const result = await provider.delete('docs', [])

      expect(result).toEqual({ error: null })
      expect(mockDel).not.toHaveBeenCalled()
    })

    it('returns error on failure', async () => {
      mockDel.mockRejectedValue(new Error('Delete failed'))

      const result = await provider.delete('docs', ['file.txt'])

      expect(result.error).toBeInstanceOf(Error)
      expect(result.error!.message).toBe('Delete failed')
    })
  })

  describe('createSignedUploadUrl', () => {
    it('throws (not supported)', async () => {
      process.env.BLOB_READ_WRITE_TOKEN = VALID_TOKEN
      const provider = new VercelBlobStorageProvider()

      await expect(provider.createSignedUploadUrl('docs', 'file.txt')).rejects.toThrow(
        'Signed upload URLs are not supported'
      )
    })
  })
})
