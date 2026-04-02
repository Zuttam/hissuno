/**
 * Sessions Service Layer
 *
 * This is the single source of truth for all session creation operations.
 * It orchestrates database operations, entity linking, and graph evaluation.
 *
 * Use this service instead of calling lib/db/queries/sessions.ts directly
 * for any create operations.
 *
 * Architecture:
 * - API Routes → sessions-service.ts → db/queries/sessions.ts + entity-relationships.ts
 * - Integration Syncs → sessions-service.ts → db schema + entity-relationships.ts
 * - Resource Adapters → sessions-service.ts → db/queries/sessions.ts
 */

import crypto from 'crypto'
import { eq, and, or, ilike, desc, sql, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import { sessions, sessionMessages } from '@/lib/db/schema/app'
import { fireGraphEval } from '@/lib/utils/graph-eval'
import { fireSessionProcessing } from '@/lib/utils/session-processing'
import { setSessionContact, linkEntities } from '@/lib/db/queries/entity-relationships'
import { rowToSessionRecord, enrichSessionsWithEntityRelationships, toSessionWithProject } from '@/lib/db/queries/sessions'
import { saveSessionMessage } from '@/lib/db/queries/session-messages'
import { generateDefaultName } from '@/lib/sessions/name-generator'
import { searchSessionsSemantic } from '@/lib/sessions/embedding-service'
import { searchByMode, type SearchMode } from '@/lib/search/search-by-mode'
import type {
  SessionSource,
  SessionType,
  SessionWithProject,
  CreateSessionInput,
} from '@/types/session'

// ============================================================================
// Types
// ============================================================================

/**
 * Input for bulk session creation with messages (integration syncs)
 */
export interface CreateSessionWithMessagesAdminInput {
  id?: string
  projectId: string
  source: SessionSource
  sessionType?: SessionType
  status?: 'active' | 'closed'
  name?: string
  description?: string
  userMetadata?: Record<string, unknown>
  firstMessageAt?: Date
  lastActivityAt?: Date
  createdAt?: Date
  messages: Array<{ sender_type: string; content: string; created_at?: Date }>
  contactId?: string
}

/**
 * Result of bulk session creation
 */
export interface CreateSessionWithMessagesAdminResult {
  sessionId: string
  messageCount: number
}

// ============================================================================
// Admin Operations (no auth required)
// ============================================================================

/**
 * Creates a session with messages in bulk. Optimized for integration syncs.
 * Uses single bulk insert for messages instead of one-by-one.
 * Returns null if session insert fails.
 */
export async function createSessionWithMessagesAdmin(
  input: CreateSessionWithMessagesAdminInput
): Promise<CreateSessionWithMessagesAdminResult | null> {
  const sessionId = input.id ?? crypto.randomUUID()
  const now = new Date()

  // 1. Insert session
  try {
    await db.insert(sessions).values({
      id: sessionId,
      project_id: input.projectId,
      source: input.source,
      session_type: input.sessionType ?? 'chat',
      status: input.status ?? 'active',
      name: input.name ?? null,
      description: input.description ?? null,
      user_metadata: input.userMetadata ?? {},
      message_count: input.messages.length,
      first_message_at: input.firstMessageAt ?? (input.messages.length > 0 ? now : null),
      last_activity_at: input.lastActivityAt ?? now,
      created_at: input.createdAt ?? now,
      updated_at: now,
      is_archived: false,
      tags: [],
    })
  } catch (error) {
    console.warn('[sessions-service] Failed to insert session:', sessionId, error)
    return null
  }

  // 2. Bulk insert messages
  if (input.messages.length > 0) {
    try {
      await db.insert(sessionMessages).values(
        input.messages.map((msg) => ({
          session_id: sessionId,
          project_id: input.projectId,
          sender_type: msg.sender_type,
          content: msg.content,
          created_at: msg.created_at ?? now,
        }))
      )
    } catch (msgError) {
      console.warn('[sessions-service] Failed to insert messages for session:', sessionId, msgError)
    }
  }

  // 3. Update message count (ensures accuracy even if some messages failed)
  try {
    await db
      .update(sessions)
      .set({ message_count: input.messages.length })
      .where(eq(sessions.id, sessionId))
  } catch {
    // Non-critical
  }

  // 4. Link contact if provided
  if (input.contactId) {
    try {
      await setSessionContact(input.projectId, sessionId, input.contactId)
    } catch (linkError) {
      console.warn('[sessions-service] Failed to link contact:', sessionId, linkError)
    }
  }

  // 5. Fire session processing if created as closed (non-blocking)
  // Session processing includes graph evaluation, so skip standalone graph eval
  if (input.status === 'closed') {
    fireSessionProcessing(sessionId, input.projectId)
  } else {
    fireGraphEval(input.projectId, 'session', sessionId)
  }

  return { sessionId, messageCount: input.messages.length }
}

/**
 * Creates a session via admin context. Standard path for resource adapters and API.
 * Handles name generation, message saving, entity linking, and graph evaluation.
 */
export async function createSessionAdmin(
  input: CreateSessionInput & { source?: SessionSource }
): Promise<SessionWithProject | null> {
  try {
    const sessionId = crypto.randomUUID()
    const messageCount = input.messages?.length ?? 0
    const now = new Date()

    const sessionName =
      input.name ||
      generateDefaultName({
        userId: input.user_metadata?.userId || null,
        source: input.source ?? 'api',
        createdAt: now.toISOString(),
      })

    const [inserted] = await db
      .insert(sessions)
      .values({
        id: sessionId,
        project_id: input.project_id,
        user_metadata: input.user_metadata || {},
        page_url: input.page_url || null,
        page_title: input.page_title || null,
        name: sessionName,
        description: input.description || null,
        source: input.source ?? 'api',
        session_type: input.session_type || 'chat',
        status: input.status ?? (messageCount > 0 ? 'closed' : 'active'),
        message_count: messageCount,
        tags: input.tags ?? [],
        custom_fields: input.custom_fields ?? null,
        is_archived: false,
        first_message_at: messageCount > 0 ? now : null,
        last_activity_at: now,
      })
      .returning()

    // Store messages in session_messages table if provided
    if (input.messages && input.messages.length > 0) {
      try {
        for (const msg of input.messages) {
          await saveSessionMessage({
            sessionId,
            projectId: input.project_id,
            senderType: msg.role === 'user' ? 'user' : 'ai',
            content: msg.content,
          })
        }
      } catch (msgError) {
        console.error('[sessions-service] Failed to store messages:', msgError)
      }
    }

    // Link entities (contact, companies, issues, etc.) - non-blocking
    try {
      const linkPromises: Promise<void>[] = []
      if (input.contact_id) {
        linkPromises.push(setSessionContact(input.project_id, sessionId, input.contact_id))
      }
      if (input.linked_entities) {
        const { companies: companyIds, issues: issueIds, knowledge_sources: ksIds, product_scopes: scopeIds } = input.linked_entities
        for (const id of companyIds ?? []) {
          linkPromises.push(linkEntities(input.project_id, 'session', sessionId, 'company', id))
        }
        for (const id of issueIds ?? []) {
          linkPromises.push(linkEntities(input.project_id, 'session', sessionId, 'issue', id))
        }
        for (const id of ksIds ?? []) {
          linkPromises.push(linkEntities(input.project_id, 'session', sessionId, 'knowledge_source', id))
        }
        for (const id of scopeIds ?? []) {
          linkPromises.push(linkEntities(input.project_id, 'session', sessionId, 'product_scope', id))
        }
      }
      await Promise.allSettled(linkPromises)
    } catch (linkError) {
      console.error('[sessions-service] Failed to link entities:', linkError)
    }

    // Fire processing (if closed) or just graph eval (if active)
    const resolvedStatus = input.status ?? (messageCount > 0 ? 'closed' : 'active')
    if (resolvedStatus === 'closed') {
      fireSessionProcessing(sessionId, input.project_id)
    } else {
      fireGraphEval(input.project_id, 'session', sessionId)
    }

    // Fetch the session with relations
    const result = await db.query.sessions.findFirst({
      where: eq(sessions.id, sessionId),
      with: {
        project: { columns: { id: true, name: true } },
      },
    })

    if (result) {
      const enrichedResults = await enrichSessionsWithEntityRelationships([result])
      return toSessionWithProject(enrichedResults[0])
    }
    return rowToSessionRecord(inserted) as unknown as SessionWithProject
  } catch (error) {
    console.error('[sessions-service] unexpected error creating session', error)
    throw error
  }
}

// ============================================================================
// Aliases - auth is handled at the route level, not in the service layer
// ============================================================================

/**
 * Creates a session. Delegates to createSessionAdmin.
 * Source defaults to 'api' if not provided.
 */
export async function createSession(input: CreateSessionInput & { source?: SessionSource }): Promise<SessionWithProject | null> {
  return createSessionAdmin(input)
}

// ============================================================================
// Search Operations
// ============================================================================

export interface SearchSessionResult {
  id: string
  name: string
  snippet: string
  score?: number
}

/**
 * Searches sessions using semantic search with full-text fallback.
 */
export async function searchSessions(
  projectId: string,
  query: string,
  limit: number = 10,
  options?: { mode?: SearchMode; threshold?: number }
): Promise<SearchSessionResult[]> {
  return searchByMode<SearchSessionResult>({
    logPrefix: '[sessions-service]',
    mode: options?.mode,
    semanticSearch: async () => {
      const semanticResults = await searchSessionsSemantic(projectId, query, {
        limit,
        threshold: options?.threshold ?? 0.5,
        isArchived: false,
      })
      return semanticResults.map((r) => ({
        id: r.sessionId,
        name: r.name ?? 'Unnamed feedback',
        snippet: r.description ?? '',
        score: r.similarity,
      }))
    },
    keywordSearch: async () => {
      const s = `%${query}%`
      const data = await db
        .select({
          id: sessions.id,
          name: sessions.name,
          description: sessions.description,
          updated_at: sessions.updated_at,
        })
        .from(sessions)
        .where(
          and(
            eq(sessions.project_id, projectId),
            eq(sessions.is_archived, false),
            or(
              ilike(sessions.name, s),
              ilike(sessions.description, s)
            )
          )
        )
        .orderBy(desc(sessions.updated_at))
        .limit(limit)

      return data.map((r) => ({
        id: r.id,
        name: r.name ?? 'Unnamed feedback',
        snippet: (r.description ?? '').slice(0, 200),
        score: 0,
      }))
    },
  })
}
