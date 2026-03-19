import { headers } from 'next/headers'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { projectMembers } from '@/lib/db/schema/app'
import { API_KEY_ID_HEADER, API_KEY_CREATED_BY_HEADER, API_KEY_PROJECT_ID_HEADER } from '@/lib/auth/identity'
import { UnauthorizedError, USER_ID_HEADER } from '@/lib/auth/server'

export interface RequestContext {
  db: typeof db
  userId: string
  /** Non-null for API key requests. Cross-project queries MUST be scoped to this. */
  apiKeyProjectId: string | null
}

/**
 * Resolves the caller's identity from proxy-injected request headers.
 *
 * Returns the Drizzle db instance along with the authenticated userId.
 * Callers MUST use userId/apiKeyProjectId to scope all queries (application-level access control).
 */
export async function resolveRequestContext(): Promise<RequestContext> {
  const h = await headers()
  const apiKeyId = h.get(API_KEY_ID_HEADER)

  if (apiKeyId) {
    const createdBy = h.get(API_KEY_CREATED_BY_HEADER)
    const projectId = h.get(API_KEY_PROJECT_ID_HEADER)
    if (!createdBy || !projectId) throw new UnauthorizedError('Invalid API key headers.')
    return { db, userId: createdBy, apiKeyProjectId: projectId }
  }

  // User request — read identity from proxy-injected headers
  const userId = h.get(USER_ID_HEADER)
  if (!userId) throw new UnauthorizedError()
  return { db, userId, apiKeyProjectId: null }
}

// ---------------------------------------------------------------------------
// Shared helpers used across query files
// ---------------------------------------------------------------------------

/** Get accessible project IDs for a user (filtered by active project_members membership). */
export async function getUserProjectIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ project_id: projectMembers.project_id })
    .from(projectMembers)
    .where(and(eq(projectMembers.user_id, userId), eq(projectMembers.status, 'active')))
  return rows.map((r) => r.project_id)
}

/** Escape LIKE metacharacters in user-provided search input. */
export function sanitizeSearchInput(input: string): string {
  return input.replace(/[%_.,()]/g, '\\$&')
}

/** Convert a Date | null to ISO string | null for record serialization. */
export function dateToIso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null
}

export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
