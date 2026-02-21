'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { IssueWithProject, IssueWithSessions, IssueFilters, CreateIssueInput, PMReviewResult } from '@/types/issue'

interface UseIssuesState {
  issues: IssueWithProject[]
  total: number
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  createIssue: (input: CreateIssueInput) => Promise<IssueWithProject | null>
  archiveIssue: (issueId: string, isArchived: boolean) => Promise<boolean>
  batchArchive: (issueIds: string[], isArchived: boolean) => Promise<boolean>
}

interface UseIssuesOptions {
  initialIssues?: IssueWithProject[]
  filters?: IssueFilters
}

export function useIssues({
  initialIssues = [],
  filters = {},
}: UseIssuesOptions = {}): UseIssuesState {
  const [issues, setIssues] = useState<IssueWithProject[]>(initialIssues)
  const [total, setTotal] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(initialIssues.length === 0)
  const [error, setError] = useState<string | null>(null)

  const fetchIssues = useCallback(async () => {
    if (!filters.projectId) {
      setIssues([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.type) params.set('type', filters.type)
      if (filters.priority) params.set('priority', filters.priority)
      if (filters.status) params.set('status', filters.status)
      if (filters.search) params.set('search', filters.search)
      if (filters.showArchived) params.set('showArchived', 'true')
      if (filters.velocityLevel) params.set('velocityLevel', filters.velocityLevel)
      if (filters.impactLevel) params.set('impactLevel', filters.impactLevel)
      if (filters.effortLevel) params.set('effortLevel', filters.effortLevel)
      if (filters.limit) params.set('limit', String(filters.limit))
      if (filters.offset) params.set('offset', String(filters.offset))

      const url = `/api/projects/${filters.projectId}/issues${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url, { cache: 'no-store' })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load issues.'
        throw new Error(message)
      }

      const payload = await response.json()
      setIssues(payload.issues ?? [])
      setTotal(payload.total ?? 0)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading issues.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [filters.projectId, filters.type, filters.priority, filters.status, filters.search, filters.showArchived, filters.velocityLevel, filters.impactLevel, filters.effortLevel, filters.limit, filters.offset])

  const createIssue = useCallback(async (input: CreateIssueInput): Promise<IssueWithProject | null> => {
    if (!filters.projectId) return null

    try {
      const response = await fetch(`/api/projects/${filters.projectId}/issues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        return null
      }

      const payload = await response.json()
      if (payload.issue) {
        setIssues((prev) => [payload.issue, ...prev])
      }
      return payload.issue ?? null
    } catch {
      return null
    }
  }, [])

  const archiveIssue = useCallback(async (issueId: string, isArchived: boolean): Promise<boolean> => {
    if (!filters.projectId) return false

    try {
      const response = await fetch(`/api/projects/${filters.projectId}/issues/${issueId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: isArchived }),
      })

      if (!response.ok) {
        return false
      }

      // Update local state
      setIssues((prev) =>
        prev.map((i) => (i.id === issueId ? { ...i, is_archived: isArchived } : i))
      )
      return true
    } catch {
      return false
    }
  }, [])

  const batchArchive = useCallback(async (issueIds: string[], isArchived: boolean): Promise<boolean> => {
    if (!filters.projectId) return false

    // Optimistic update
    const prevIssues = issues
    setIssues((prev) =>
      prev.map((i) => (issueIds.includes(i.id) ? { ...i, is_archived: isArchived } : i))
    )

    try {
      const response = await fetch(`/api/projects/${filters.projectId}/issues/batch/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ issueIds, is_archived: isArchived }),
      })

      if (!response.ok) {
        setIssues(prevIssues)
        return false
      }

      return true
    } catch {
      setIssues(prevIssues)
      return false
    }
  }, [filters.projectId, issues])

  useEffect(() => {
    void fetchIssues()
  }, [fetchIssues])

  return useMemo(
    () => ({
      issues,
      total,
      isLoading,
      error,
      refresh: fetchIssues,
      createIssue,
      archiveIssue,
      batchArchive,
    }),
    [issues, total, isLoading, error, fetchIssues, createIssue, archiveIssue, batchArchive]
  )
}

interface UseIssueDetailOptions {
  projectId?: string | null
  issueId?: string | null
}

interface UseIssueDetailState {
  issue: IssueWithSessions | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  updateIssue: (updates: Partial<IssueWithSessions>) => Promise<boolean>
  deleteIssue: () => Promise<boolean>
  generateSpec: () => Promise<{ success: boolean; spec?: string }>
  linkSession: (sessionId: string) => Promise<boolean>
  unlinkSession: (sessionId: string) => Promise<boolean>
}

export function useIssueDetail({
  projectId,
  issueId,
}: UseIssueDetailOptions): UseIssueDetailState {
  const [issue, setIssue] = useState<IssueWithSessions | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(issueId && projectId))
  const [error, setError] = useState<string | null>(null)

  const fetchIssue = useCallback(async () => {
    if (!issueId || !projectId) {
      setIssue(null)
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/issues/${issueId}`, { cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load issue.'
        throw new Error(message)
      }
      const payload = await response.json()
      setIssue(payload.issue ?? null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading issue.'
      setError(message)
      setIssue(null)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, issueId])

  const updateIssueFn = useCallback(async (updates: Partial<IssueWithSessions>): Promise<boolean> => {
    if (!projectId || !issueId) return false

    try {
      const response = await fetch(`/api/projects/${projectId}/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) {
        return false
      }

      const payload = await response.json()
      if (payload.issue) {
        setIssue((prev) => (prev ? { ...prev, ...payload.issue } : payload.issue))
      }
      return true
    } catch {
      return false
    }
  }, [projectId, issueId])

  const deleteIssueFn = useCallback(async (): Promise<boolean> => {
    if (!projectId || !issueId) return false

    try {
      const response = await fetch(`/api/projects/${projectId}/issues/${issueId}`, {
        method: 'DELETE',
      })

      return response.ok
    } catch {
      return false
    }
  }, [projectId, issueId])

  const linkSessionFn = useCallback(async (sessionId: string): Promise<boolean> => {
    if (!projectId || !issueId) return false

    try {
      const response = await fetch(`/api/projects/${projectId}/issues/${issueId}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })

      if (!response.ok) return false

      await fetchIssue()
      return true
    } catch {
      return false
    }
  }, [projectId, issueId, fetchIssue])

  const unlinkSessionFn = useCallback(async (sessionId: string): Promise<boolean> => {
    if (!projectId || !issueId) return false

    try {
      const response = await fetch(`/api/projects/${projectId}/issues/${issueId}/sessions`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId }),
      })

      if (!response.ok) return false

      // Optimistic removal from local state
      setIssue((prev) =>
        prev
          ? {
              ...prev,
              sessions: prev.sessions.filter((s) => s.id !== sessionId),
            }
          : null
      )
      return true
    } catch {
      return false
    }
  }, [projectId, issueId])

  const generateSpecFn = useCallback(async (): Promise<{ success: boolean; spec?: string }> => {
    if (!projectId || !issueId) return { success: false }

    try {
      const response = await fetch(`/api/projects/${projectId}/issues/${issueId}/generate-spec`, {
        method: 'POST',
      })

      if (!response.ok) {
        return { success: false }
      }

      const payload = await response.json()
      if (payload.success && payload.spec) {
        setIssue((prev) =>
          prev
            ? {
                ...prev,
                product_spec: payload.spec,
                product_spec_generated_at: payload.generatedAt,
              }
            : null
        )
      }
      return { success: payload.success, spec: payload.spec }
    } catch {
      return { success: false }
    }
  }, [projectId, issueId])

  useEffect(() => {
    void fetchIssue()
  }, [fetchIssue])

  return useMemo(
    () => ({
      issue,
      isLoading,
      error,
      refresh: fetchIssue,
      updateIssue: updateIssueFn,
      deleteIssue: deleteIssueFn,
      generateSpec: generateSpecFn,
      linkSession: linkSessionFn,
      unlinkSession: unlinkSessionFn,
    }),
    [issue, isLoading, error, fetchIssue, updateIssueFn, deleteIssueFn, generateSpecFn, linkSessionFn, unlinkSessionFn]
  )
}

interface UsePMReviewState {
  isReviewing: boolean
  result: PMReviewResult | null
  error: string | null
  triggerReview: (projectId: string, sessionId: string) => Promise<PMReviewResult | null>
}

export function usePMReview(): UsePMReviewState {
  const [isReviewing, setIsReviewing] = useState(false)
  const [result, setResult] = useState<PMReviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const triggerReview = useCallback(async (projectId: string, sessionId: string): Promise<PMReviewResult | null> => {
    setIsReviewing(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/sessions/${sessionId}/review`, {
        method: 'POST',
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'PM review failed.'
        throw new Error(message)
      }

      const payload = await response.json()
      const reviewResult = payload.result as PMReviewResult
      setResult(reviewResult)
      return reviewResult
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error during PM review.'
      setError(message)
      return null
    } finally {
      setIsReviewing(false)
    }
  }, [])

  return useMemo(
    () => ({
      isReviewing,
      result,
      error,
      triggerReview,
    }),
    [isReviewing, result, error, triggerReview]
  )
}
