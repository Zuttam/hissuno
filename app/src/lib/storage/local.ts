/**
 * Local filesystem storage provider.
 * Stores files under `data/storage/{bucket}/{path}` relative to the app root.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import type {
  FileStorageProvider,
  UploadResult,
  DownloadResult,
  DownloadTextResult,
  DeleteResult,
  SignedUploadUrlResult,
} from './types'

const STORAGE_ROOT = join(process.cwd(), 'data', 'storage')

export class LocalFileStorageProvider implements FileStorageProvider {
  private safePath(bucket: string, filePath: string): string {
    const fullPath = join(STORAGE_ROOT, bucket, filePath)
    const resolved = resolve(fullPath)
    if (!resolved.startsWith(resolve(STORAGE_ROOT) + '/')) {
      throw new Error('Invalid storage path')
    }
    return resolved
  }

  async upload(
    bucket: string,
    path: string,
    data: Uint8Array | string,
    options?: { contentType?: string; upsert?: boolean }
  ): Promise<UploadResult> {
    try {
      const fullPath = this.safePath(bucket, path)
      const dir = dirname(fullPath)

      if (!options?.upsert && existsSync(fullPath)) {
        return { path, error: new Error('File already exists') }
      }

      mkdirSync(dir, { recursive: true })

      if (typeof data === 'string') {
        writeFileSync(fullPath, data, 'utf-8')
      } else {
        writeFileSync(fullPath, data)
      }

      return { path, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload file'
      return { path, error: new Error(message) }
    }
  }

  async download(bucket: string, path: string): Promise<DownloadResult> {
    try {
      const fullPath = this.safePath(bucket, path)

      if (!existsSync(fullPath)) {
        return { data: null, error: new Error('File not found') }
      }

      const buffer = readFileSync(fullPath)
      const blob = new Blob([buffer])
      return { data: blob, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download file'
      return { data: null, error: new Error(message) }
    }
  }

  async downloadText(bucket: string, path: string): Promise<DownloadTextResult> {
    try {
      const fullPath = this.safePath(bucket, path)

      if (!existsSync(fullPath)) {
        return { content: null, error: new Error('File not found') }
      }

      const content = readFileSync(fullPath, 'utf-8')
      return { content, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download file'
      return { content: null, error: new Error(message) }
    }
  }

  async delete(bucket: string, paths: string[]): Promise<DeleteResult> {
    try {
      for (const p of paths) {
        const fullPath = this.safePath(bucket, p)
        if (existsSync(fullPath)) {
          unlinkSync(fullPath)
        }
      }
      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete file'
      return { error: new Error(message) }
    }
  }

  async createSignedUploadUrl(): Promise<SignedUploadUrlResult> {
    throw new Error('Signed upload URLs are not supported by the local storage provider.')
  }
}
