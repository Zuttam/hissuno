import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { validateCSVFileName, createCSVUploadUrl, MAX_CSV_FILE_SIZE } from '@/lib/customers/csv-storage'

export const runtime = 'nodejs'

/**
 * Simple in-memory per-user upload rate limiter.
 * Max 20 uploads per 60-second window.
 */
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_UPLOADS = 20
const uploadTimestamps = new Map<string, number[]>()

function checkUploadRateLimit(userId: string): boolean {
  const now = Date.now()
  const timestamps = uploadTimestamps.get(userId) ?? []
  const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS)

  if (recent.length >= RATE_LIMIT_MAX_UPLOADS) {
    uploadTimestamps.set(userId, recent)
    return false
  }

  recent.push(now)
  uploadTimestamps.set(userId, recent)
  return true
}

type RouteParams = { id: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * POST /api/projects/[id]/customers/import/upload
 * Generate a presigned upload URL for a CSV file.
 * Expects JSON body: { filename, fileSize? }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const actingUserId = identity.type === 'user' ? identity.userId : identity.createdByUserId

    // Rate limit
    if (!checkUploadRateLimit(actingUserId)) {
      return NextResponse.json(
        { error: 'Upload rate limit exceeded. Please wait before uploading more files.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const filename = body.filename as string | undefined
    const fileSize = body.fileSize as number | undefined

    if (!filename || typeof filename !== 'string') {
      return NextResponse.json({ error: 'Filename is required.' }, { status: 400 })
    }

    // Validate filename
    const filenameError = validateCSVFileName(filename)
    if (filenameError) {
      return NextResponse.json({ error: filenameError }, { status: 400 })
    }

    // Validate file size if provided
    if (fileSize != null && fileSize > MAX_CSV_FILE_SIZE) {
      const sizeMB = (fileSize / (1024 * 1024)).toFixed(1)
      return NextResponse.json(
        { error: `File too large (${sizeMB}MB). Maximum size is 5MB.` },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const { uploadUrl, token, storagePath, error: urlError } = await createCSVUploadUrl(projectId, filename, supabase)

    if (urlError) {
      console.error('[import.upload] Failed to create upload URL:', urlError)
      return NextResponse.json({ error: 'Failed to generate upload URL.' }, { status: 500 })
    }

    return NextResponse.json({ uploadUrl, token, storagePath })
  } catch (error) {
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
