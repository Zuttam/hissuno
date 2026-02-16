import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { parseCSVContent, validateAndImportRows } from '@/lib/customers/csv-import'
import { downloadCSVImport, deleteCSVImport } from '@/lib/customers/csv-storage'
import type { CustomerEntityType, CSVImportMapping } from '@/types/customer'

export const runtime = 'nodejs'

type RouteParams = { id: string }
type RouteContext = { params: Promise<RouteParams> }

const MAX_ROW_COUNT = 500

/**
 * POST /api/projects/[id]/customers/import
 * Import companies or contacts from a CSV previously uploaded to storage.
 * Expects JSON body: { storagePath, entityType, mappings, createMissingCompanies? }
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const identity = await requireRequestIdentity()
    await assertProjectAccess(identity, projectId)
    const supabase = await createClient()

    const body = await request.json()
    const storagePath = body.storagePath as string | undefined
    const entityType = body.entityType as CustomerEntityType | undefined
    const mappings = body.mappings as CSVImportMapping[] | undefined
    const createMissingCompanies = body.createMissingCompanies === true

    if (!storagePath || typeof storagePath !== 'string') {
      return NextResponse.json({ error: 'storagePath is required.' }, { status: 400 })
    }

    if (!entityType || !['company', 'contact'].includes(entityType)) {
      return NextResponse.json({ error: 'Valid entityType is required (company or contact).' }, { status: 400 })
    }

    if (!Array.isArray(mappings)) {
      return NextResponse.json({ error: 'Column mappings are required.' }, { status: 400 })
    }

    // Verify the storage path belongs to this project
    if (!storagePath.startsWith(`${projectId}/`)) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }

    // Download CSV from storage
    const { content, error: downloadError } = await downloadCSVImport(storagePath, supabase)
    if (downloadError || content == null) {
      console.error('[import.post] Failed to download CSV:', downloadError)
      return NextResponse.json({ error: 'Failed to download CSV file.' }, { status: 500 })
    }

    // Parse CSV
    const parsed = parseCSVContent(content)

    if (parsed.rows.length === 0) {
      return NextResponse.json({ error: 'No rows to import.' }, { status: 400 })
    }

    if (parsed.rows.length > MAX_ROW_COUNT) {
      return NextResponse.json(
        { error: `Too many rows. Maximum is ${MAX_ROW_COUNT.toLocaleString()} rows (got ${parsed.rows.length.toLocaleString()}).` },
        { status: 400 }
      )
    }

    const result = await validateAndImportRows(projectId, entityType, parsed.rows, mappings, supabase, { createMissingCompanies })

    // Cleanup: delete CSV from storage (best-effort)
    void deleteCSVImport(storagePath, supabase)

    return NextResponse.json({ result })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    if (error instanceof ForbiddenError) {
      return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
    }
    console.error('[import.post] unexpected error', error)
    return NextResponse.json({ error: 'Unable to import data.' }, { status: 500 })
  }
}
