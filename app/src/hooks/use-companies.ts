'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  CompanyWithContacts,
  CompanyFilters,
  CreateCompanyInput,
  UpdateCompanyInput,
} from '@/types/customer'
import {
  listCompanies,
  getCompany,
  createCompany as apiCreateCompany,
  updateCompany as apiUpdateCompany,
  deleteCompany as apiDeleteCompany,
  archiveCompany as apiArchiveCompany,
} from '@/lib/api/companies'

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
      const payload = await listCompanies(filters.projectId, {
        stage: filters.stage,
        search: filters.search,
        industry: filters.industry,
        planTier: filters.planTier,
        country: filters.country,
        showArchived: filters.showArchived,
        limit: filters.limit,
        offset: filters.offset,
      })
      setCompanies(payload.companies ?? [])
      setTotal(payload.total ?? 0)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading companies.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [filters.projectId, filters.stage, filters.search, filters.industry, filters.planTier, filters.country, filters.showArchived, filters.limit, filters.offset])

  const createCompanyFn = useCallback(async (input: CreateCompanyInput): Promise<CompanyWithContacts | null> => {
    if (!filters.projectId) return null

    try {
      const payload = await apiCreateCompany(filters.projectId, input)
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

  const archiveCompanyFn = useCallback(async (companyId: string, isArchived: boolean): Promise<boolean> => {
    if (!filters.projectId) return false

    try {
      const response = await apiArchiveCompany(filters.projectId, companyId, isArchived)
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
      createCompany: createCompanyFn,
      archiveCompany: archiveCompanyFn,
    }),
    [companies, total, isLoading, error, fetchCompanies, createCompanyFn, archiveCompanyFn]
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
      const payload = await getCompany(projectId, companyId)
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
      const payload = await apiUpdateCompany(projectId, companyId, updates)
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
      const response = await apiDeleteCompany(projectId, companyId)
      return response.ok
    } catch {
      return false
    }
  }, [projectId, companyId])

  const archiveCompanyFn = useCallback(async (isArchived: boolean): Promise<boolean> => {
    if (!projectId || !companyId) return false

    try {
      const response = await apiArchiveCompany(projectId, companyId, isArchived)
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
