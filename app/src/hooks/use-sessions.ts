'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SessionWithProject, SessionWithMessages, SessionFilters, ChatMessage, CreateSessionInput, UpdateSessionInput } from '@/types/session'

interface UseSessionsState {
  sessions: SessionWithProject[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  createSession: (input: CreateSessionInput) => Promise<SessionWithProject | null>
  archiveSession: (sessionId: string, isArchived: boolean) => Promise<boolean>
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
  const [isLoading, setIsLoading] = useState<boolean>(initialSessions.length === 0)
  const [error, setError] = useState<string | null>(null)

  const fetchSessions = useCallback(async () => {
    if (!filters.projectId) {
      setSessions([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.userId) params.set('userId', filters.userId)
      if (filters.sessionId) params.set('sessionId', filters.sessionId)
      if (filters.name) params.set('name', filters.name)
      if (filters.status) params.set('status', filters.status)
      if (filters.source) params.set('source', filters.source)
      if (filters.tags && filters.tags.length > 0) params.set('tags', filters.tags.join(','))
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      if (filters.showArchived) params.set('showArchived', 'true')
      if (filters.isHumanTakeover) params.set('isHumanTakeover', 'true')
      if (filters.limit) params.set('limit', String(filters.limit))
      if (filters.offset) params.set('offset', String(filters.offset))

      const url = `/api/projects/${filters.projectId}/sessions${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url, { cache: 'no-store' })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load sessions.'
        throw new Error(message)
      }

      const payload = await response.json()
      setSessions(payload.sessions ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading sessions.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [filters.projectId, filters.userId, filters.sessionId, filters.name, filters.status, filters.source, filters.tags, filters.dateFrom, filters.dateTo, filters.showArchived, filters.isHumanTakeover, filters.limit, filters.offset])

  const createSession = useCallback(async (input: CreateSessionInput): Promise<SessionWithProject | null> => {
    if (!filters.projectId) return null

    try {
      const response = await fetch(`/api/projects/${filters.projectId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        return null
      }

      const payload = await response.json()
      if (payload.session) {
        setSessions((prev) => [payload.session, ...prev])
      }
      return payload.session ?? null
    } catch {
      return null
    }
  }, [])

  const archiveSession = useCallback(async (sessionId: string, isArchived: boolean): Promise<boolean> => {
    if (!filters.projectId) return false

    try {
      const response = await fetch(`/api/projects/${filters.projectId}/sessions/${sessionId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: isArchived }),
      })

      if (!response.ok) {
        return false
      }

      // Update local state
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, is_archived: isArchived } : s))
      )
      return true
    } catch {
      return false
    }
  }, [])

  useEffect(() => {
    void fetchSessions()
  }, [fetchSessions])

  return useMemo(
    () => ({
      sessions,
      isLoading,
      error,
      refresh: fetchSessions,
      createSession,
      archiveSession,
    }),
    [sessions, isLoading, error, fetchSessions, createSession, archiveSession]
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
      const response = await fetch(`/api/projects/${projectId}/sessions/${sessionId}`, { cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load session.'
        throw new Error(message)
      }
      const payload = await response.json()
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
      const response = await fetch(`/api/projects/${projectId}/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        return false
      }

      const payload = await response.json()
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
