'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  CompanyWithContacts,
  CompanyFilters,
  CreateCompanyInput,
  UpdateCompanyInput,
} from '@/types/customer'

interface UseCompaniesState {
  companies: CompanyWithContacts[]
  total: number
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  createCompany: (input: CreateCompanyInput) => Promise<CompanyWithContacts | null>
  archiveCompany: (companyId: string, isArchived: boolean) => Promise<boolean>
}

interface UseCompaniesOptions {
  filters?: CompanyFilters
}

export function useCompanies({
  filters = {},
}: UseCompaniesOptions = {}): UseCompaniesState {
  const [companies, setCompanies] = useState<CompanyWithContacts[]>([])
  const [total, setTotal] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCompanies = useCallback(async () => {
    if (!filters.projectId) {
      setCompanies([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (filters.stage) params.set('stage', filters.stage)
      if (filters.search) params.set('search', filters.search)
      if (filters.industry) params.set('industry', filters.industry)
      if (filters.planTier) params.set('planTier', filters.planTier)
      if (filters.country) params.set('country', filters.country)
      if (filters.showArchived) params.set('showArchived', 'true')
      if (filters.limit) params.set('limit', String(filters.limit))
      if (filters.offset) params.set('offset', String(filters.offset))

      const url = `/api/projects/${filters.projectId}/customers/companies${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url, { cache: 'no-store' })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load companies.'
        throw new Error(message)
      }

      const payload = await response.json()
      setCompanies(payload.companies ?? [])
      setTotal(payload.total ?? 0)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading companies.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [filters.projectId, filters.stage, filters.search, filters.industry, filters.planTier, filters.country, filters.showArchived, filters.limit, filters.offset])

  const createCompany = useCallback(async (input: CreateCompanyInput): Promise<CompanyWithContacts | null> => {
    if (!filters.projectId) return null

    try {
      const response = await fetch(`/api/projects/${filters.projectId}/customers/companies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      if (!response.ok) return null

      const payload = await response.json()
      if (payload.company) {
        // Add empty contacts array for list display
        const companyWithContacts = { ...payload.company, contacts: [], contact_count: 0 }
        setCompanies((prev) => [companyWithContacts, ...prev])
        return companyWithContacts
      }
      return null
    } catch {
      return null
    }
  }, [filters.projectId])

  const archiveCompany = useCallback(async (companyId: string, isArchived: boolean): Promise<boolean> => {
    if (!filters.projectId) return false

    try {
      const response = await fetch(`/api/projects/${filters.projectId}/customers/companies/${companyId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: isArchived }),
      })

      if (!response.ok) return false

      setCompanies((prev) =>
        prev.map((c) => (c.id === companyId ? { ...c, is_archived: isArchived } : c))
      )
      return true
    } catch {
      return false
    }
  }, [filters.projectId])

  useEffect(() => {
    void fetchCompanies()
  }, [fetchCompanies])

  return useMemo(
    () => ({
      companies,
      total,
      isLoading,
      error,
      refresh: fetchCompanies,
      createCompany,
      archiveCompany,
    }),
    [companies, total, isLoading, error, fetchCompanies, createCompany, archiveCompany]
  )
}

// ============================================================================
// Company Detail Hook
// ============================================================================

interface UseCompanyDetailOptions {
  projectId?: string | null
  companyId?: string | null
}

interface UseCompanyDetailState {
  company: CompanyWithContacts | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  updateCompany: (updates: UpdateCompanyInput) => Promise<boolean>
  deleteCompany: () => Promise<boolean>
  archiveCompany: (isArchived: boolean) => Promise<boolean>
}

export function useCompanyDetail({
  projectId,
  companyId,
}: UseCompanyDetailOptions): UseCompanyDetailState {
  const [company, setCompany] = useState<CompanyWithContacts | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(companyId && projectId))
  const [error, setError] = useState<string | null>(null)

  const fetchCompany = useCallback(async () => {
    if (!companyId || !projectId) {
      setCompany(null)
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`/api/projects/${projectId}/customers/companies/${companyId}`, { cache: 'no-store' })
      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load company.'
        throw new Error(message)
      }
      const payload = await response.json()
      setCompany(payload.company ?? null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading company.'
      setError(message)
      setCompany(null)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, companyId])

  const updateCompanyFn = useCallback(async (updates: UpdateCompanyInput): Promise<boolean> => {
    if (!projectId || !companyId) return false

    try {
      const response = await fetch(`/api/projects/${projectId}/customers/companies/${companyId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) return false

      const payload = await response.json()
      if (payload.company) {
        setCompany((prev) => (prev ? { ...prev, ...payload.company } : payload.company))
      }
      return true
    } catch {
      return false
    }
  }, [projectId, companyId])

  const deleteCompanyFn = useCallback(async (): Promise<boolean> => {
    if (!projectId || !companyId) return false

    try {
      const response = await fetch(`/api/projects/${projectId}/customers/companies/${companyId}`, {
        method: 'DELETE',
      })
      return response.ok
    } catch {
      return false
    }
  }, [projectId, companyId])

  const archiveCompanyFn = useCallback(async (isArchived: boolean): Promise<boolean> => {
    if (!projectId || !companyId) return false

    try {
      const response = await fetch(`/api/projects/${projectId}/customers/companies/${companyId}/archive`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_archived: isArchived }),
      })

      if (!response.ok) return false

      setCompany((prev) => (prev ? { ...prev, is_archived: isArchived } : prev))
      return true
    } catch {
      return false
    }
  }, [projectId, companyId])

  useEffect(() => {
    void fetchCompany()
  }, [fetchCompany])

  return useMemo(
    () => ({
      company,
      isLoading,
      error,
      refresh: fetchCompany,
      updateCompany: updateCompanyFn,
      deleteCompany: deleteCompanyFn,
      archiveCompany: archiveCompanyFn,
    }),
    [company, isLoading, error, fetchCompany, updateCompanyFn, deleteCompanyFn, archiveCompanyFn]
  )
}
