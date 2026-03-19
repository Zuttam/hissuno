import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { requireProjectId, MissingProjectIdError } from '@/lib/auth/project-context'
import { isDatabaseConfigured } from '@/lib/db/config'
import { downloadCSVImport } from '@/lib/customers/csv-storage'
import { parseCSVContent, suggestMappings } from '@/lib/customers/csv-import'
import type { CustomerEntityType } from '@/types/customer'

export const runtime = 'nodejs'

const MAX_ROW_COUNT = 500

/**
 * Validates that content is text (no binary bytes in the first 1KB).
 * Reuses the same logic as validateUploadedFile's text check in knowledge/storage.ts.
 */
function validateTextContent(content: string): string | null {
  const bytes = new TextEncoder().encode(content.slice(0, 1024))
  for (const byte of bytes) {
    // Allow common text control characters: tab, newline, carriage return
    if (byte < 0x09 || (byte > 0x0d && byte < 0x20 && byte !== 0x1b)) {
      return 'File appears to contain binary content. Please upload a valid CSV file.'
    }
  }
  return null
}

/**
 * POST /api/contacts/import/parse?projectId=...
 * Download CSV from storage, parse, and return headers + suggested mappings.
 * Expects JSON body: { storagePath, entityType }
 */
export async function POST(request: NextRequest) {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: 'Database must be configured.' }, { status: 500 })
  }

  try {
    const projectId = requireProjectId(request)
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const body = await request.json()
    const storagePath = body.storagePath as string | undefined
    const entityType = body.entityType as CustomerEntityType | undefined

    if (!storagePath || typeof storagePath !== 'string') {
      return NextResponse.json({ error: 'storagePath is required.' }, { status: 400 })
    }

    if (!entityType || !['company', 'contact'].includes(entityType)) {
      return NextResponse.json({ error: 'Valid entityType is required (company or contact).' }, { status: 400 })
    }

    // Verify the storage path belongs to this project
    if (!storagePath.startsWith(`${projectId}/`)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    // Download CSV from storage
    const { content, error: downloadError } = await downloadCSVImport(storagePath)
    if (downloadError || content == null) {
      console.error('[import.parse] Failed to download CSV:', downloadError)
      return NextResponse.json({ error: 'Failed to download CSV file.' }, { status: 500 })
    }

    // Validate content is text (not binary)
    const textError = validateTextContent(content)
    if (textError) {
      return NextResponse.json({ error: textError }, { status: 400 })
    }

    // Parse CSV
    const parsed = parseCSVContent(content)

    if (parsed.headers.length === 0) {
      return NextResponse.json({ error: 'Could not parse CSV headers.' }, { status: 400 })
    }

    if (parsed.rows.length > MAX_ROW_COUNT) {
      return NextResponse.json(
        { error: `Too many rows. Maximum is ${MAX_ROW_COUNT.toLocaleString()} rows (got ${parsed.rows.length.toLocaleString()}).` },
        { status: 400 }
      )
    }

    // Suggest column mappings
    const suggestedMappings = suggestMappings(parsed.headers, entityType)
    // Attach sample values
    for (const mapping of suggestedMappings) {
      mapping.sampleValues = parsed.rows.slice(0, 3).map((r) => r[mapping.csvColumn] ?? '')
    }

    return NextResponse.json({
      headers: parsed.headers,
      rowCount: parsed.rows.length,
      sampleRows: parsed.rows.slice(0, 5),
      suggestedMappings,
    })
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
    console.error('[import.parse] unexpected error', error)
    return NextResponse.json({ error: 'Failed to parse CSV file.' }, { status: 500 })
  }
}
