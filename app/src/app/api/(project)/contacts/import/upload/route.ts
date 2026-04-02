import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { isDatabaseConfigured } from '@/lib/db/config'
import { validateCSVFileName, createCSVUploadUrl, uploadCSVDirect, MAX_CSV_FILE_SIZE } from '@/lib/customers/csv-storage'
import { getRateLimiter } from '@/lib/utils/rate-limiter'

export const runtime = 'nodejs'

const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_UPLOADS = 20

function validateCSVFile(filename: string, fileSize?: number | null): string | null {
  const filenameError = validateCSVFileName(filename)
  if (filenameError) return filenameError

  if (fileSize != null && fileSize > MAX_CSV_FILE_SIZE) {
    const sizeMB = (fileSize / (1024 * 1024)).toFixed(1)
    return `File too large (${sizeMB}MB). Maximum size is 5MB.`
  }
  return null
}

/**
 * POST /api/contacts/import/upload?projectId=...
 *
 * Two modes:
 * 1. JSON body { filename, fileSize } - returns a presigned upload URL (S3, etc.)
 * 2. FormData with "file" field - server-side upload (Vercel Blob, local, etc.)
 *
 * The client should try mode 1 first, then fall back to mode 2 if it gets an error.
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const actingUserId = identity.type === 'user' ? identity.userId : identity.createdByUserId

    // Rate limit (configurable via RATE_LIMITER env var: "memory" | "db")
    const allowed = await getRateLimiter().check(
      `csv-upload:${actingUserId}`,
      RATE_LIMIT_WINDOW_MS,
      RATE_LIMIT_MAX_UPLOADS,
    )
    if (!allowed) {
      return NextResponse.json(
        { error: 'Upload rate limit exceeded. Please wait before uploading more files.' },
        { status: 429 },
      )
    }

    const contentType = request.headers.get('content-type') ?? ''

    // Mode 2: FormData with file - server-side upload
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('file') as File | null

      if (!file) {
        return NextResponse.json({ error: 'File is required.' }, { status: 400 })
      }

      const validationError = validateCSVFile(file.name, file.size)
      if (validationError) {
        return NextResponse.json({ error: validationError }, { status: 400 })
      }

      const buffer = new Uint8Array(await file.arrayBuffer())
      const { storagePath, error: uploadError } = await uploadCSVDirect(projectId, file.name, buffer)

      if (uploadError) {
        console.error('[import.upload] Direct upload failed:', uploadError)
        return NextResponse.json({ error: 'Failed to upload file.' }, { status: 500 })
      }

      return NextResponse.json({ storagePath })
    }

    // Mode 1: JSON body - presigned URL
    const body = await request.json()
    const filename = body.filename as string | undefined
    const fileSize = body.fileSize as number | undefined

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'Filename is required.' }, { status: 400 })
    }

    const validationError = validateCSVFile(filename, fileSize)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const { uploadUrl, token, storagePath, error: urlError } = await createCSVUploadUrl(projectId, filename)

    if (urlError) {
      console.error('[import.upload] Failed to create upload URL:', urlError)
      return NextResponse.json({ error: 'Failed to generate upload URL.' }, { status: 500 })
    }

    return NextResponse.json({ uploadUrl, token, storagePath })
  } catch (error) {
    if (error instanceof MissingProjectIdError) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[import.upload] unexpected error', error)
    return NextResponse.json({ error: 'Failed to generate upload URL.' }, { status: 500 })
  }
}
