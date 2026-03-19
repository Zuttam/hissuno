/**
 * Storage provider factory.
 *
 * Selects the appropriate storage provider based on environment configuration.
 * Default: local filesystem (no external dependencies).
 * Set STORAGE_PROVIDER=s3 to use S3-compatible storage (AWS S3, MinIO, R2, etc.).
 * Set STORAGE_PROVIDER=vercel-blob to use Vercel Blob (zero-config on Vercel).
 */

import type { FileStorageProvider } from './types'

export type { FileStorageProvider } from './types'
export type {
  UploadResult,
  DownloadResult,
  DownloadTextResult,
  DeleteResult,
  SignedUploadUrlResult,
} from './types'

let _provider: FileStorageProvider | null = null

export function getStorageProvider(): FileStorageProvider {
  if (_provider) return _provider

  const providerType = process.env.STORAGE_PROVIDER ?? 'local'

  switch (providerType) {
    case 's3': {
      // Dynamic import to avoid pulling in AWS SDK when not needed
      const { S3FileStorageProvider } = require('./s3') as typeof import('./s3')
      _provider = new S3FileStorageProvider()
      break
    }
    case 'vercel-blob': {
      // Dynamic import to avoid pulling in Vercel Blob SDK when not needed
      const { VercelBlobStorageProvider } = require('./vercel-blob') as typeof import('./vercel-blob')
      _provider = new VercelBlobStorageProvider()
      break
    }
    case 'local':
    default: {
      const { LocalFileStorageProvider } = require('./local') as typeof import('./local')
      _provider = new LocalFileStorageProvider()
      break
    }
  }

  return _provider
}
