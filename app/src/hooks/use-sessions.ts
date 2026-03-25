'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SessionWithProject, SessionWithMessages, SessionFilters, ChatMessage, CreateSessionInput, UpdateSessionInput } from '@/types/session'
import {
  listSessions,
  getSession,
  createSession as apiCreateSession,
  updateSession as apiUpdateSession,
  archiveSession as apiArchiveSession,
  batchArchiveSessions,
  batchSetCustomer as apiBatchSetCustomer,
} from '@/lib/api/sessions'
import { useDebounce } from './use-debounce'

interface UseSessionsState {
  sessions: SessionWithProject[]
  total: number
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  createSession: (input: CreateSessionInput) => Promise<SessionWithProject | null>
  archiveSession: (sessionId: string, isArchived: boolean) => Promise<boolean>
  batchArchive: (sessionIds: string[], isArchived: boolean) => Promise<boolean>
  batchSetCustomer: (sessionIds: string[], contactId: string | null) => Promise<{ success: boolean; error?: string }>
}

interface UseSessionsOptions {
  initialSessions?: SessionWithProject[]
  filters?: SessionFilters
}

export function useSessions({
  initialSessions = [],
  filters = {},
}: UseSessionsOptions = {}): UseSessionsState {
  const [sessions, setSessions] = useState<SessionWithProject[]>(initialSessions)
  const [total, setTotal] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(initialSessions.length === 0)
  const [error, setError] = useState<string | null>(null)

  const debouncedSearch = useDebounce(filters.search, 300)

  const fetchSessions = useCallback(async () => {
    if (!filters.projectId) {
      setSessions([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const payload = await listSessions(filters.projectId, {
        sessionId: filters.sessionId,
        name: filters.name,
        search: debouncedSearch,
        status: filters.status,
        source: filters.source,
        tags: filters.tags,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
        showArchived: filters.showArchived,
        isHumanTakeover: filters.isHumanTakeover,
        isAnalyzed: filters.isAnalyzed,
        companyId: filters.companyId,
        contactId: filters.contactId,
        productScopeIds: filters.productScopeIds,
        limit: filters.limit,
        offset: filters.offset,
      })
      setSessions(payload.sessions ?? [])
      setTotal(payload.total ?? 0)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading sessions.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [filters.projectId, filters.sessionId, filters.name, debouncedSearch, filters.status, filters.source, filters.tags, filters.dateFrom, filters.dateTo, filters.showArchived, filters.isHumanTakeover, filters.isAnalyzed, filters.companyId, filters.contactId, filters.productScopeIds, filters.limit, filters.offset])

  const createSessionFn = useCallback(async (input: CreateSessionInput): Promise<SessionWithProject | null> => {
    if (!filters.projectId) return null

    try {
      const payload = await apiCreateSession(filters.projectId, input)
      if (payload.session) {
        setSessions((prev) => [payload.session, ...prev])
      }
      return payload.session ?? null
    } catch {
      return null
    }
  }, [filters.projectId])

  const archiveSessionFn = useCallback(async (sessionId: string, isArchived: boolean): Promise<boolean> => {
    if (!filters.projectId) return false

    try {
      await apiArchiveSession(filters.projectId, sessionId, isArchived)

      // Update local state
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, is_archived: isArchived } : s))
      )
      return true
    } catch {
      return false
    }
  }, [filters.projectId])

  const batchArchive = useCallback(async (sessionIds: string[], isArchived: boolean): Promise<boolean> => {
    if (!filters.projectId) return false

    // Optimistic update
    const prevSessions = sessions
    setSessions((prev) =>
      prev.map((s) => (sessionIds.includes(s.id) ? { ...s, is_archived: isArchived } : s))
    )

    try {
      await batchArchiveSessions(filters.projectId, sessionIds, isArchived)
      return true
    } catch {
      setSessions(prevSessions)
      return false
    }
  }, [filters.projectId, sessions])

  const batchSetCustomer = useCallback(async (sessionIds: string[], contactId: string | null): Promise<{ success: boolean; error?: string }> => {
    if (!filters.projectId) return { success: false, error: 'No project selected.' }

    try {
      const result = await apiBatchSetCustomer(filters.projectId, sessionIds, contactId)
      if (!result.success) {
        console.error('[batchSetCustomer] failed', { error: result.error, sessionIds, contactId })
        return { success: false, error: result.error }
      }

      // Refresh to get updated contact data
      void fetchSessions()
      return { success: true }
    } catch {
      return { success: false, error: 'Unexpected error setting customer.' }
    }
  }, [filters.projectId, fetchSessions])

  useEffect(() => {
    void fetchSessions()
  }, [fetchSessions])

  return useMemo(
    () => ({
      sessions,
      total,
      isLoading,
      error,
      refresh: fetchSessions,
      createSession: createSessionFn,
      archiveSession: archiveSessionFn,
      batchArchive,
      batchSetCustomer,
    }),
    [sessions, total, isLoading, error, fetchSessions, createSessionFn, archiveSessionFn, batchArchive, batchSetCustomer]
  )
}

interface UseSessionDetailOptions {
  projectId?: string | null
  sessionId?: string | null
}

interface UseSessionDetailState {
  session: SessionWithProject | null
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  updateSession: (input: UpdateSessionInput) => Promise<boolean>
}

export function useSessionDetail({
  projectId,
  sessionId,
}: UseSessionDetailOptions): UseSessionDetailState {
  const [session, setSession] = useState<SessionWithProject | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(sessionId && projectId))
  const [error, setError] = useState<string | null>(null)

  const fetchSession = useCallback(async () => {
    if (!sessionId || !projectId) {
      setSession(null)
      setMessages([])
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const payload = await getSession(projectId, sessionId)
      setSession(payload.session ?? null)
      setMessages(payload.messages ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading session.'
      setError(message)
      setSession(null)
      setMessages([])
    } finally {
      setIsLoading(false)
    }
  }, [projectId, sessionId])

  const updateSessionFn = useCallback(async (input: UpdateSessionInput): Promise<boolean> => {
    if (!projectId || !sessionId) return false

    try {
      const payload = await apiUpdateSession(projectId, sessionId, input)
      if (payload.session) {
        setSession((prev) => prev ? { ...prev, ...payload.session } : payload.session)
      }
      return true
    } catch {
      return false
    }
  }, [projectId, sessionId])

  useEffect(() => {
    void fetchSession()
  }, [fetchSession])

  return useMemo(
    () => ({
      session,
      messages,
      isLoading,
      error,
      refresh: fetchSession,
      updateSession: updateSessionFn,
    }),
    [session, messages, isLoading, error, fetchSession, updateSessionFn]
  )
}
