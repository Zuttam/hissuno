'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { SessionWithProject, SessionWithMessages, SessionFilters, ChatMessage } from '@/types/session'

interface UseSessionsState {
  sessions: SessionWithProject[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
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
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.projectId) params.set('projectId', filters.projectId)
      if (filters.userId) params.set('userId', filters.userId)
      if (filters.sessionId) params.set('sessionId', filters.sessionId)
      if (filters.status) params.set('status', filters.status)
      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
      if (filters.dateTo) params.set('dateTo', filters.dateTo)
      if (filters.limit) params.set('limit', String(filters.limit))
      if (filters.offset) params.set('offset', String(filters.offset))

      const url = `/api/sessions${params.toString() ? `?${params.toString()}` : ''}`
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
  }, [filters.projectId, filters.userId, filters.sessionId, filters.status, filters.dateFrom, filters.dateTo, filters.limit, filters.offset])

  useEffect(() => {
    void fetchSessions()
  }, [fetchSessions])

  return useMemo(
    () => ({
      sessions,
      isLoading,
      error,
      refresh: fetchSessions,
    }),
    [sessions, isLoading, error, fetchSessions]
  )
}

interface UseSessionDetailOptions {
  sessionId?: string | null
}

interface UseSessionDetailState {
  session: SessionWithProject | null
  messages: ChatMessage[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

export function useSessionDetail({
  sessionId,
}: UseSessionDetailOptions): UseSessionDetailState {
  const [session, setSession] = useState<SessionWithProject | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(sessionId))
  const [error, setError] = useState<string | null>(null)

  const fetchSession = useCallback(async () => {
    if (!sessionId) {
      setSession(null)
      setMessages([])
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/sessions/${sessionId}`, { cache: 'no-store' })
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
  }, [sessionId])

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
    }),
    [session, messages, isLoading, error, fetchSession]
  )
}
