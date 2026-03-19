'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { IssueWithProject, IssueWithSessions, IssueFilters, CreateIssueInput, PMReviewResult } from '@/types/issue'
import {
  listIssues,
  getIssue,
  createIssue as apiCreateIssue,
  updateIssue as apiUpdateIssue,
  deleteIssue as apiDeleteIssue,
  archiveIssue as apiArchiveIssue,
  batchArchiveIssues,
  linkSession as apiLinkSession,
  unlinkSession as apiUnlinkSession,
} from '@/lib/api/issues'
import { triggerSessionReview } from '@/lib/api/sessions'

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

  // Debounce search filter to avoid firing on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState(filters.search)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    if (filters.search === debouncedSearch) return
    clearTimeout(debounceTimerRef.current)
    debounceTimerRef.current = setTimeout(() => {
      setDebouncedSearch(filters.search)
    }, 300)
    return () => clearTimeout(debounceTimerRef.current)
  }, [filters.search, debouncedSearch])

  const fetchIssues = useCallback(async () => {
    if (!filters.projectId) {
      setIssues([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const payload = await listIssues(filters.projectId, {
        type: filters.type,
        priority: filters.priority,
        status: filters.status,
        search: debouncedSearch,
        showArchived: filters.showArchived,
        reachLevel: filters.reachLevel,
        impactLevel: filters.impactLevel,
        confidenceLevel: filters.confidenceLevel,
        effortLevel: filters.effortLevel,
        productScopeIds: filters.productScopeIds && filters.productScopeIds.length > 0 ? filters.productScopeIds.join(',') : undefined,
        limit: filters.limit,
        offset: filters.offset,
      })
      setIssues(payload.issues ?? [])
      setTotal(payload.total ?? 0)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading issues.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [filters.projectId, filters.type, filters.priority, filters.status, debouncedSearch, filters.showArchived, filters.reachLevel, filters.impactLevel, filters.confidenceLevel, filters.effortLevel, filters.productScopeIds, filters.limit, filters.offset])

  const createIssueFn = useCallback(async (input: CreateIssueInput): Promise<IssueWithProject | null> => {
    if (!filters.projectId) return null

    try {
      const payload = await apiCreateIssue(filters.projectId, input)
      if (payload.issue) {
        setIssues((prev) => [payload.issue, ...prev])
      }
      return payload.issue ?? null
    } catch {
      return null
    }
  }, [filters.projectId])

  const archiveIssueFn = useCallback(async (issueId: string, isArchived: boolean): Promise<boolean> => {
    if (!filters.projectId) return false

    try {
      const response = await apiArchiveIssue(filters.projectId, issueId, isArchived)
      if (!response.ok) return false

      // Update local state
      setIssues((prev) =>
        prev.map((i) => (i.id === issueId ? { ...i, is_archived: isArchived } : i))
      )
      return true
    } catch {
      return false
    }
  }, [filters.projectId])

  const batchArchive = useCallback(async (issueIds: string[], isArchived: boolean): Promise<boolean> => {
    if (!filters.projectId) return false

    // Optimistic update
    const prevIssues = issues
    setIssues((prev) =>
      prev.map((i) => (issueIds.includes(i.id) ? { ...i, is_archived: isArchived } : i))
    )

    try {
      const response = await batchArchiveIssues(filters.projectId, issueIds, isArchived)
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
      createIssue: createIssueFn,
      archiveIssue: archiveIssueFn,
      batchArchive,
    }),
    [issues, total, isLoading, error, fetchIssues, createIssueFn, archiveIssueFn, batchArchive]
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
      const payload = await getIssue(projectId, issueId)
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
      const payload = await apiUpdateIssue(projectId, issueId, updates)
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
      const response = await apiDeleteIssue(projectId, issueId)
      return response.ok
    } catch {
      return false
    }
  }, [projectId, issueId])

  const linkSessionFn = useCallback(async (sessionId: string): Promise<boolean> => {
    if (!projectId || !issueId) return false

    try {
      const response = await apiLinkSession(projectId, issueId, sessionId)
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
      const response = await apiUnlinkSession(projectId, issueId, sessionId)
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
      linkSession: linkSessionFn,
      unlinkSession: unlinkSessionFn,
    }),
    [issue, isLoading, error, fetchIssue, updateIssueFn, deleteIssueFn, linkSessionFn, unlinkSessionFn]
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

  const triggerReviewFn = useCallback(async (projectId: string, sessionId: string): Promise<PMReviewResult | null> => {
    setIsReviewing(true)
    setError(null)
    setResult(null)

    try {
      const response = await triggerSessionReview(projectId, sessionId)
      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        const message = typeof payload?.error === 'string' ? payload.error : 'PM review failed.'
        throw new Error(message)
      }

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
      triggerReview: triggerReviewFn,
    }),
    [isReviewing, result, error, triggerReviewFn]
  )
}
