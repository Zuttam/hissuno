import { NextRequest, NextResponse } from 'next/server'
import { UnauthorizedError } from '@/lib/auth/server'
import { assertUserOwnsProject } from '@/lib/auth/authorization'
import { createClient, isSupabaseConfigured } from '@/lib/supabase/server'
import { parseCSVContent, validateAndImportRows } from '@/lib/customers/csv-import'
import type { CustomerEntityType, CSVImportMapping } from '@/types/customer'

export const runtime = 'nodejs'

type RouteParams = { id: string }
type RouteContext = { params: Promise<RouteParams> }

async function resolveUser() {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new UnauthorizedError('User not authenticated')
  }

  return { supabase, user }
}

/**
 * POST /api/projects/[id]/customers/import
 * Import companies or contacts from CSV.
 * Expects FormData with: file (CSV), entity_type, mappings (JSON string)
 */
export async function POST(request: NextRequest, context: RouteContext) {
  const { id: projectId } = await context.params

  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: 'Supabase must be configured.' }, { status: 500 })
  }

  try {
    const { supabase, user } = await resolveUser()
    await assertUserOwnsProject(supabase, user.id, projectId)

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const entityType = formData.get('entity_type') as CustomerEntityType | null
    const mappingsJson = formData.get('mappings') as string | null

    if (!file) {
      return NextResponse.json({ error: 'CSV file is required.' }, { status: 400 })
    }
    if (!entityType || !['company', 'contact'].includes(entityType)) {
      return NextResponse.json({ error: 'Valid entity_type is required (company or contact).' }, { status: 400 })
    }
    if (!mappingsJson) {
      return NextResponse.json({ error: 'Column mappings are required.' }, { status: 400 })
    }

    let mappings: CSVImportMapping[]
    try {
      mappings = JSON.parse(mappingsJson) as CSVImportMapping[]
    } catch {
      return NextResponse.json({ error: 'Invalid mappings JSON.' }, { status: 400 })
    }

    const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
    const MAX_ROW_COUNT = 500

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: `File too large. Maximum size is 5MB (got ${(file.size / 1024 / 1024).toFixed(1)}MB).` }, { status: 400 })
    }

    const text = await file.text()
    const { rows } = parseCSVContent(text)

    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV file is empty.' }, { status: 400 })
    }

    if (rows.length > MAX_ROW_COUNT) {
      return NextResponse.json({ error: `Too many rows. Maximum is ${MAX_ROW_COUNT.toLocaleString()} rows (got ${rows.length.toLocaleString()}).` }, { status: 400 })
    }

    const result = await validateAndImportRows(projectId, entityType, rows, mappings, supabase)

    return NextResponse.json({ result })
  } catch (error) {
    if (error instanceof UnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }
    console.error('[import.post] unexpected error', error)
    return NextResponse.json({ error: 'Unable to import data.' }, { status: 500 })
  }
}
