import { NextRequest, NextResponse } from 'next/server'
import { requireRequestIdentity } from '@/lib/auth/identity'
import { assertProjectAccess, ForbiddenError } from '@/lib/auth/authorization'
import { UnauthorizedError } from '@/lib/auth/server'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { validateAndImportRows } from '@/lib/customers/csv-import'
import type { CustomerEntityType, CSVImportMapping } from '@/types/customer'

export const runtime = 'nodejs'

type RouteParams = { id: string }
type RouteContext = { params: Promise<RouteParams> }

/**
 * POST /api/projects/[id]/customers/import
 * Import companies or contacts from pre-parsed CSV rows.
 * Expects JSON body: { entity_type, rows, mappings, create_missing_companies? }
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
    const entityType = body.entity_type as CustomerEntityType | null
    const rows = body.rows as Record<string, string>[] | null
    const mappings = body.mappings as CSVImportMapping[] | null
    const createMissingCompanies = body.create_missing_companies === true

    if (!entityType || !['company', 'contact'].includes(entityType)) {
      return NextResponse.json({ error: 'Valid entity_type is required (company or contact).' }, { status: 400 })
    }
    if (!Array.isArray(rows)) {
      return NextResponse.json({ error: 'Rows array is required.' }, { status: 400 })
    }
    if (!Array.isArray(mappings)) {
      return NextResponse.json({ error: 'Column mappings are required.' }, { status: 400 })
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No rows to import.' }, { status: 400 })
    }

    const MAX_ROW_COUNT = 500
    if (rows.length > MAX_ROW_COUNT) {
      return NextResponse.json({ error: `Too many rows. Maximum is ${MAX_ROW_COUNT.toLocaleString()} rows (got ${rows.length.toLocaleString()}).` }, { status: 400 })
    }

    const result = await validateAndImportRows(projectId, entityType, rows, mappings, supabase, { createMissingCompanies })

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
