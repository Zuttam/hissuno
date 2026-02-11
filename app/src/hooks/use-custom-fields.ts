'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  CustomFieldDefinition,
  CustomerEntityType,
  CreateCustomFieldInput,
  UpdateCustomFieldInput,
} from '@/types/customer'

interface UseCustomFieldsState {
  fields: CustomFieldDefinition[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  createField: (input: CreateCustomFieldInput) => Promise<CustomFieldDefinition | null>
  updateField: (fieldId: string, updates: UpdateCustomFieldInput) => Promise<boolean>
  deleteField: (fieldId: string) => Promise<boolean>
}

interface UseCustomFieldsOptions {
  projectId?: string | null
  entityType?: CustomerEntityType
}

export function useCustomFields({
  projectId,
  entityType,
}: UseCustomFieldsOptions = {}): UseCustomFieldsState {
  const [fields, setFields] = useState<CustomFieldDefinition[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const fetchFields = useCallback(async () => {
    if (!projectId) {
      setFields([])
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (entityType) params.set('entity_type', entityType)

      const url = `/api/projects/${projectId}/customers/custom-fields${params.toString() ? `?${params.toString()}` : ''}`
      const response = await fetch(url, { cache: 'no-store' })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        const message = typeof payload?.error === 'string' ? payload.error : 'Failed to load custom fields.'
        throw new Error(message)
      }

      const payload = await response.json()
      setFields(payload.fields ?? [])
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading custom fields.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, entityType])

  const createField = useCallback(async (input: CreateCustomFieldInput): Promise<CustomFieldDefinition | null> => {
    if (!projectId) return null

    try {
      const response = await fetch(`/api/projects/${projectId}/customers/custom-fields`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => null)
        if (typeof payload?.error === 'string') {
          throw new Error(payload.error)
        }
        return null
      }

      const payload = await response.json()
      if (payload.field) {
        setFields((prev) => [...prev, payload.field])
        return payload.field
      }
      return null
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      }
      return null
    }
  }, [projectId])

  const updateField = useCallback(async (fieldId: string, updates: UpdateCustomFieldInput): Promise<boolean> => {
    if (!projectId) return false

    try {
      const response = await fetch(`/api/projects/${projectId}/customers/custom-fields/${fieldId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })

      if (!response.ok) return false

      const payload = await response.json()
      if (payload.field) {
        setFields((prev) => prev.map((f) => (f.id === fieldId ? payload.field : f)))
      }
      return true
    } catch {
      return false
    }
  }, [projectId])

  const deleteField = useCallback(async (fieldId: string): Promise<boolean> => {
    if (!projectId) return false

    try {
      const response = await fetch(`/api/projects/${projectId}/customers/custom-fields/${fieldId}`, {
        method: 'DELETE',
      })

      if (!response.ok) return false

      setFields((prev) => prev.filter((f) => f.id !== fieldId))
      return true
    } catch {
      return false
    }
  }, [projectId])

  useEffect(() => {
    void fetchFields()
  }, [fetchFields])

  return useMemo(
    () => ({
      fields,
      isLoading,
      error,
      refresh: fetchFields,
      createField,
      updateField,
      deleteField,
    }),
    [fields, isLoading, error, fetchFields, createField, updateField, deleteField]
  )
}
