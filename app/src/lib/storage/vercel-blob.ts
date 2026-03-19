/**
 * Vercel Blob storage provider.
 * Zero-config on Vercel (auto-injects BLOB_READ_WRITE_TOKEN).
 *
 * Logical "buckets" from the FileStorageProvider interface are mapped to
 * path prefixes: `{bucket}/{path}`.
 *
 * Uses `addRandomSuffix: false` so blob URLs are deterministic and the
 * provider can reconstruct full URLs from logical paths.
 *
 * Environment variables:
 *   BLOB_READ_WRITE_TOKEN  - Required. Auto-set by Vercel when Blob storage is connected.
 *   BLOB_STORE_URL         - Optional. Override the store base URL (derived from token by default).
 *   BLOB_ACCESS            - Optional. 'public' or 'private' (default: 'private').
 */

import { put, del, get } from '@vercel/blob'
import type {
  FileStorageProvider,
  UploadResult,
  DownloadResult,
  DownloadTextResult,
  DeleteResult,
  SignedUploadUrlResult,
} from './types'

export class VercelBlobStorageProvider implements FileStorageProvider {
  private storeBaseUrl: string
  private access: 'public' | 'private'

  constructor() {
    const token = process.env.BLOB_READ_WRITE_TOKEN
    if (!token) {
      throw new Error(
        'BLOB_READ_WRITE_TOKEN is required for Vercel Blob storage. ' +
        'Connect Blob storage in your Vercel project to auto-inject it.'
      )
    }

    this.access = (process.env.BLOB_ACCESS === 'public') ? 'public' : 'private'

    if (process.env.BLOB_STORE_URL) {
      this.storeBaseUrl = process.env.BLOB_STORE_URL.replace(/\/$/, '')
    } else {
      // Derive from token format: vercel_blob_rw_<storeId>_<rest>
      const match = token.match(/^vercel_blob_rw_([a-zA-Z0-9]+)_/)
      if (!match) {
        throw new Error(
          'Could not derive store URL from BLOB_READ_WRITE_TOKEN. ' +
          'Set BLOB_STORE_URL explicitly.'
        )
      }
      const subdomain = this.access === 'private' ? 'private' : 'public'
      this.storeBaseUrl = `https://${match[1]}.${subdomain}.blob.vercel-storage.com`
    }
  }

  /** Map logical bucket + path to a blob pathname. */
  private pathname(bucket: string, path: string): string {
    return `${bucket}/${path}`
  }

  /** Construct the full blob URL from bucket and path. */
  private blobUrl(bucket: string, path: string): string {
    return `${this.storeBaseUrl}/${this.pathname(bucket, path)}`
  }

  /**
   * Read a blob's content as a Uint8Array using the SDK's get() function,
   * which handles authentication for both public and private stores.
   */
  private async readBlob(bucket: string, path: string): Promise<Uint8Array> {
    const result = await get(this.blobUrl(bucket, path), { access: this.access })

    if (!result || !result.stream) {
      throw new Error('Blob not found or empty')
    }

    const buffer = await new Response(result.stream).arrayBuffer()
    return new Uint8Array(buffer)
  }

  async upload(
    bucket: string,
    path: string,
    data: Uint8Array | string,
    options?: { contentType?: string; upsert?: boolean }
  ): Promise<UploadResult> {
    try {
      const body = typeof data === 'string' ? data : Buffer.from(data)

      await put(this.pathname(bucket, path), body, {
        access: this.access,
        contentType: options?.contentType ?? 'application/octet-stream',
        addRandomSuffix: false,
      })

      return { path, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload file'
      console.error(`[storage.vercel-blob] Upload failed for ${bucket}/${path}:`, err)
      return { path, error: new Error(message) }
    }
  }

  async download(bucket: string, path: string): Promise<DownloadResult> {
    try {
      const bytes = await this.readBlob(bucket, path)
      const blob = new Blob([Buffer.from(bytes)])
      return { data: blob, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download file'
      console.error(`[storage.vercel-blob] Download failed for ${bucket}/${path}:`, err)
      return { data: null, error: new Error(message) }
    }
  }

  async downloadText(bucket: string, path: string): Promise<DownloadTextResult> {
    try {
      const bytes = await this.readBlob(bucket, path)
      const content = new TextDecoder().decode(bytes)
      return { content, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download file'
      console.error(`[storage.vercel-blob] Download text failed for ${bucket}/${path}:`, err)
      return { content: null, error: new Error(message) }
    }
  }

  async delete(bucket: string, paths: string[]): Promise<DeleteResult> {
    if (paths.length === 0) {
      return { error: null }
    }

    try {
      const urls = paths.map((p) => this.blobUrl(bucket, p))
      await del(urls)
      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete files'
      console.error(`[storage.vercel-blob] Delete failed for ${bucket}:`, err)
      return { error: new Error(message) }
    }
  }

  async createSignedUploadUrl(_bucket: string, _path: string): Promise<SignedUploadUrlResult> {
    throw new Error('Signed upload URLs are not supported by the Vercel Blob provider. Use server-side upload instead.')
  }
}
