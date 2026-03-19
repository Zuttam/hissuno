/**
 * S3 storage provider.
 * Works with AWS S3 and any S3-compatible service (MinIO, R2, etc.).
 *
 * Logical "buckets" from the FileStorageProvider interface are mapped to
 * key prefixes inside a single S3 bucket: `{bucket}/{path}`.
 *
 * Environment variables:
 *   S3_ENDPOINT          - Custom endpoint (for MinIO / S3-compatible). Omit for AWS.
 *   S3_REGION            - AWS region (default: us-east-1)
 *   S3_ACCESS_KEY_ID     - Access key
 *   S3_SECRET_ACCESS_KEY - Secret key
 *   S3_BUCKET            - S3 bucket name (default: hissuno)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectsCommand,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import type {
  FileStorageProvider,
  UploadResult,
  DownloadResult,
  DownloadTextResult,
  DeleteResult,
  SignedUploadUrlResult,
} from './types'

export class S3FileStorageProvider implements FileStorageProvider {
  private client: S3Client
  private bucket: string

  constructor() {
    const endpoint = process.env.S3_ENDPOINT
    this.client = new S3Client({
      endpoint: endpoint || undefined,
      region: process.env.S3_REGION ?? 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: Boolean(endpoint), // Required for MinIO / S3-compatible
    })
    this.bucket = process.env.S3_BUCKET ?? 'hissuno'
  }

  /** Map logical bucket + path to an S3 object key. */
  private key(bucket: string, path: string): string {
    return `${bucket}/${path}`
  }

  async upload(
    bucket: string,
    path: string,
    data: Uint8Array | string,
    options?: { contentType?: string; upsert?: boolean }
  ): Promise<UploadResult> {
    try {
      const body = typeof data === 'string' ? Buffer.from(data, 'utf-8') : data

      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: this.key(bucket, path),
          Body: body,
          ContentType: options?.contentType ?? 'application/octet-stream',
        })
      )

      return { path, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to upload file'
      console.error(`[storage.s3] Upload failed for ${bucket}/${path}:`, err)
      return { path, error: new Error(message) }
    }
  }

  async download(bucket: string, path: string): Promise<DownloadResult> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.key(bucket, path),
        })
      )

      if (!response.Body) {
        return { data: null, error: new Error('Empty response body') }
      }

      const bytes = await response.Body.transformToByteArray()
      const blob = new Blob([Buffer.from(bytes)], {
        type: response.ContentType ?? 'application/octet-stream',
      })

      return { data: blob, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download file'
      console.error(`[storage.s3] Download failed for ${bucket}/${path}:`, err)
      return { data: null, error: new Error(message) }
    }
  }

  async downloadText(bucket: string, path: string): Promise<DownloadTextResult> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: this.key(bucket, path),
        })
      )

      if (!response.Body) {
        return { content: null, error: new Error('Empty response body') }
      }

      const content = await response.Body.transformToString('utf-8')
      return { content, error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download file'
      console.error(`[storage.s3] Download text failed for ${bucket}/${path}:`, err)
      return { content: null, error: new Error(message) }
    }
  }

  async delete(bucket: string, paths: string[]): Promise<DeleteResult> {
    if (paths.length === 0) {
      return { error: null }
    }

    try {
      // DeleteObjects supports up to 1000 keys per request
      const batchSize = 1000
      for (let i = 0; i < paths.length; i += batchSize) {
        const batch = paths.slice(i, i + batchSize)
        await this.client.send(
          new DeleteObjectsCommand({
            Bucket: this.bucket,
            Delete: {
              Objects: batch.map((p) => ({ Key: this.key(bucket, p) })),
              Quiet: true,
            },
          })
        )
      }

      return { error: null }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete files'
      console.error(`[storage.s3] Delete failed for ${bucket}:`, err)
      return { error: new Error(message) }
    }
  }

  async createSignedUploadUrl(bucket: string, path: string): Promise<SignedUploadUrlResult> {
    try {
      const key = this.key(bucket, path)
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
      })

      const uploadUrl = await getSignedUrl(this.client, command, { expiresIn: 3600 })

      return {
        uploadUrl,
        token: '', // S3 pre-signed URLs are self-contained (no separate token)
        storagePath: path,
        error: null,
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create signed upload URL'
      console.error(`[storage.s3] Signed URL failed for ${bucket}/${path}:`, err)
      return { uploadUrl: '', token: '', storagePath: '', error: new Error(message) }
    }
  }
}
