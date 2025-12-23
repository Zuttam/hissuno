'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { IssueWithProject, IssueWithSessions, IssueFilters, PMReviewResult } from '@/types/issue'

interface UseIssuesState {
  issues: IssueWithProject[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
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
  const [isLoading, setIsLoading] = useState<boolean>(initialIssues.length === 0)
  const [error, setError] = useState<string | null>(null)

  const fetchIssues = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.projectId) params.set('projectId', filters.projectId)
      if (filters.type) params.set('type', filters.type)
      if (filters.priority) params.set('priority', filters.priority)
      if (filters.status) params.set('status', filters.status)
      if (filters.search) params.set('search', filters.search)
      if (filters.limit) params.set('limit', String(filters.limit))
      if (filters.offset) params.set('offset', String(filters.offset))

      const url = `/api/issues${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url, { cache: 'no-store' })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load issues.'
        throw new Error(message)
      }

      const payload = await response.json()
      setIssues(payload.issues ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading issues.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [filters.projectId, filters.type, filters.priority, filters.status, filters.search, filters.limit, filters.offset])

  useEffect(() => {
    void fetchIssues()
  }, [fetchIssues])

  return useMemo(
    () => ({
      issues,
      isLoading,
      error,
      refresh: fetchIssues,
    }),
    [issues, isLoading, error, fetchIssues]
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
}

export function useIssueDetail({
  projectId,
  issueId,
}: UseIssueDetailOptions): UseIssueDetailState {
  const [issue, setIssue] = useState<IssueWithSessions | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(issueId))
  const [error, setError] = useState<string | null>(null)

  const fetchIssue = useCallback(async () => {
    if (!projectId || !issueId) {
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
    }),
    [issue, isLoading, error, fetchIssue, updateIssueFn, deleteIssueFn, generateSpecFn]
  )
}

interface UsePMReviewState {
  isReviewing: boolean
  result: PMReviewResult | null
  error: string | null
  triggerReview: (sessionId: string) => Promise<PMReviewResult | null>
}

export function usePMReview(): UsePMReviewState {
  const [isReviewing, setIsReviewing] = useState(false)
  const [result, setResult] = useState<PMReviewResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const triggerReview = useCallback(async (sessionId: string): Promise<PMReviewResult | null> => {
    setIsReviewing(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`/api/sessions/${sessionId}/pm-review`, {
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
