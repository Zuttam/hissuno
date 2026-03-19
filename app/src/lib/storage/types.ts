/**
 * File storage provider interface.
 * Abstracts away the underlying storage (Supabase Storage, local filesystem, S3, etc.)
 */

export interface UploadResult {
  path: string
  error: Error | null
}

export interface DownloadResult {
  data: Blob | null
  error: Error | null
}

export interface DownloadTextResult {
  content: string | null
  error: Error | null
}

export interface DeleteResult {
  error: Error | null
}

export interface SignedUploadUrlResult {
  uploadUrl: string
  token: string
  storagePath: string
  error: Error | null
}

export interface FileStorageProvider {
  /**
   * Upload a file (as Uint8Array or string) to the given bucket and path.
   */
  upload(bucket: string, path: string, data: Uint8Array | string, options?: {
    contentType?: string
    upsert?: boolean
  }): Promise<UploadResult>

  /**
   * Download a file as a Blob.
   */
  download(bucket: string, path: string): Promise<DownloadResult>

  /**
   * Download a file and return its text content.
   */
  downloadText(bucket: string, path: string): Promise<DownloadTextResult>

  /**
   * Delete one or more files.
   */
  delete(bucket: string, paths: string[]): Promise<DeleteResult>

  /**
   * Create a signed upload URL (for client-side direct upload).
   * Not all providers support this — throws if unsupported.
   */
  createSignedUploadUrl(bucket: string, path: string): Promise<SignedUploadUrlResult>
}
