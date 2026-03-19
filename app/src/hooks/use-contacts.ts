'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  ContactWithCompany,
  ContactFilters,
  CreateContactInput,
  UpdateContactInput,
} from '@/types/customer'
import {
  listContacts,
  getContact,
  createContact as apiCreateContact,
  updateContact as apiUpdateContact,
  deleteContact as apiDeleteContact,
  archiveContact as apiArchiveContact,
} from '@/lib/api/contacts'

interface UseContactsState {
  contacts: ContactWithCompany[]
  total: number
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  createContact: (input: CreateContactInput) => Promise<ContactWithCompany | null>
  archiveContact: (contactId: string, isArchived: boolean) => Promise<boolean>
}

interface UseContactsOptions {
  filters?: ContactFilters
}

export function useContacts({
  filters = {},
}: UseContactsOptions = {}): UseContactsState {
  const [contacts, setContacts] = useState<ContactWithCompany[]>([])
  const [total, setTotal] = useState<number>(0)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchContacts = useCallback(async () => {
    if (!filters.projectId) {
      setContacts([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const payload = await listContacts(filters.projectId, {
        companyId: filters.companyId,
        isChampion: filters.isChampion,
        search: filters.search,
        role: filters.role,
        title: filters.title,
        showArchived: filters.showArchived,
        limit: filters.limit,
        offset: filters.offset,
      })
      setContacts(payload.contacts ?? [])
      setTotal(payload.total ?? 0)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading contacts.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [filters.projectId, filters.companyId, filters.isChampion, filters.search, filters.role, filters.title, filters.showArchived, filters.limit, filters.offset])

  const createContactFn = useCallback(async (input: CreateContactInput): Promise<ContactWithCompany | null> => {
    if (!filters.projectId) return null

    try {
      const payload = await apiCreateContact(filters.projectId, input)
      if (payload.contact) {
        const contactWithCompany = { ...payload.contact, company: null }
        setContacts((prev) => [contactWithCompany, ...prev])
        return contactWithCompany
      }
      return null
    } catch {
      return null
    }
  }, [filters.projectId])

  const archiveContactFn = useCallback(async (contactId: string, isArchived: boolean): Promise<boolean> => {
    if (!filters.projectId) return false

    try {
      const response = await apiArchiveContact(filters.projectId, contactId, isArchived)
      if (!response.ok) return false

      setContacts((prev) =>
        prev.map((c) => (c.id === contactId ? { ...c, is_archived: isArchived } : c))
      )
      return true
    } catch {
      return false
    }
  }, [filters.projectId])

  useEffect(() => {
    void fetchContacts()
  }, [fetchContacts])

  return useMemo(
    () => ({
      contacts,
      total,
      isLoading,
      error,
      refresh: fetchContacts,
      createContact: createContactFn,
      archiveContact: archiveContactFn,
    }),
    [contacts, total, isLoading, error, fetchContacts, createContactFn, archiveContactFn]
  )
}

// ============================================================================
// Contact Detail Hook
// ============================================================================

interface UseContactDetailOptions {
  projectId?: string | null
  contactId?: string | null
}

interface UseContactDetailState {
  contact: ContactWithCompany | null
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  updateContact: (updates: UpdateContactInput) => Promise<boolean>
  deleteContact: () => Promise<boolean>
  archiveContact: (isArchived: boolean) => Promise<boolean>
}

export function useContactDetail({
  projectId,
  contactId,
}: UseContactDetailOptions): UseContactDetailState {
  const [contact, setContact] = useState<ContactWithCompany | null>(null)
  const [isLoading, setIsLoading] = useState<boolean>(Boolean(contactId && projectId))
  const [error, setError] = useState<string | null>(null)

  const fetchContact = useCallback(async () => {
    if (!contactId || !projectId) {
      setContact(null)
      setIsLoading(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const payload = await getContact(projectId, contactId)
      setContact(payload.contact ?? null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading contact.'
      setError(message)
      setContact(null)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, contactId])

  const updateContactFn = useCallback(async (updates: UpdateContactInput): Promise<boolean> => {
    if (!projectId || !contactId) return false

    try {
      const payload = await apiUpdateContact(projectId, contactId, updates)
      if (payload.contact) {
        setContact((prev) => (prev ? { ...prev, ...payload.contact } : payload.contact))
      }
      return true
    } catch {
      return false
    }
  }, [projectId, contactId])

  const deleteContactFn = useCallback(async (): Promise<boolean> => {
    if (!projectId || !contactId) return false

    try {
      const response = await apiDeleteContact(projectId, contactId)
      return response.ok
    } catch {
      return false
    }
  }, [projectId, contactId])

  const archiveContactFn = useCallback(async (isArchived: boolean): Promise<boolean> => {
    if (!projectId || !contactId) return false

    try {
      const response = await apiArchiveContact(projectId, contactId, isArchived)
      if (!response.ok) return false

      setContact((prev) => (prev ? { ...prev, is_archived: isArchived } : prev))
      return true
    } catch {
      return false
    }
  }, [projectId, contactId])

  useEffect(() => {
    void fetchContact()
  }, [fetchContact])

  return useMemo(
    () => ({
      contact,
      isLoading,
      error,
      refresh: fetchContact,
      updateContact: updateContactFn,
      deleteContact: deleteContactFn,
      archiveContact: archiveContactFn,
    }),
    [contact, isLoading, error, fetchContact, updateContactFn, deleteContactFn, archiveContactFn]
  )
}
