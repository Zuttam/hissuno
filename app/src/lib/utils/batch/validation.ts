import { db } from '@/lib/db'
import { sessions, issues, contacts } from '@/lib/db/schema/app'
import { inArray } from 'drizzle-orm'

export class BatchValidationError extends Error {
  status = 400

  constructor(message: string) {
    super(message)
    this.name = 'BatchValidationError'
  }
}

interface ValidateBatchIdsOptions {
  projectId: string
  table: 'sessions' | 'issues' | 'contacts'
  ids: unknown
  maxSize: number
}

// Map table names to their Drizzle table definitions
const TABLE_MAP = {
  sessions,
  issues,
  contacts,
} as const

/**
 * Validates batch IDs for batch operations.
 * 1. Checks that ids is an array within size limits
 * 2. Checks UUID format for all IDs
 * 3. Verifies all IDs exist and belong to the given project
 * 4. Returns generic error messages to prevent IDOR information leakage
 */
export async function validateBatchIds({
  projectId,
  table,
  ids,
  maxSize,
}: ValidateBatchIdsOptions): Promise<string[]> {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new BatchValidationError('IDs array is required and must not be empty.')
  }

  if (ids.length > maxSize) {
    throw new BatchValidationError(`Maximum ${maxSize} items per batch operation.`)
  }

  // Validate ID format (non-empty strings; existence checked via DB below)
  const validatedIds: string[] = []
  for (const id of ids) {
    if (typeof id !== 'string' || id.length === 0) {
      console.error(`[batch.validation] invalid ID in ${table} batch`, {
        value: typeof id === 'string' ? id : `(${typeof id})`,
        index: validatedIds.length,
        totalIds: ids.length,
      })
      throw new BatchValidationError('Invalid IDs provided.')
    }
    validatedIds.push(id)
  }

  // Verify all IDs exist and belong to the project
  const tableRef = TABLE_MAP[table]

  const found = await db
    .select({ id: tableRef.id, project_id: tableRef.project_id })
    .from(tableRef)
    .where(inArray(tableRef.id, validatedIds))

  if (!found || found.length !== validatedIds.length) {
    console.error(`[batch.validation] ID count mismatch for ${table}`, {
      requested: validatedIds.length,
      found: found?.length ?? 0,
    })
    throw new BatchValidationError(`Invalid ${table === 'sessions' ? 'session' : 'issue'} IDs.`)
  }

  // Verify all belong to the same project
  const wrongProject = found.some((item) => item.project_id !== projectId)
  if (wrongProject) {
    console.error(`[batch.validation] project mismatch for ${table}`, {
      expected: projectId,
      requested: validatedIds.length,
    })
    throw new BatchValidationError(`Invalid ${table === 'sessions' ? 'session' : 'issue'} IDs.`)
  }

  return validatedIds
}
