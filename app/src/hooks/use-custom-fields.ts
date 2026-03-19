'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type {
  CustomFieldDefinition,
  CustomerEntityType,
  CreateCustomFieldInput,
  UpdateCustomFieldInput,
} from '@/types/customer'
import {
  listCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
} from '@/lib/api/customers'

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
      const result = await listCustomFields(projectId, entityType)
      setFields(result)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unexpected error loading custom fields.'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }, [projectId, entityType])

  const createFieldFn = useCallback(async (input: CreateCustomFieldInput): Promise<CustomFieldDefinition | null> => {
    if (!projectId) return null

    try {
      const field = await createCustomField(projectId, input)
      setFields((prev) => [...prev, field])
      return field
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message)
      }
      return null
    }
  }, [projectId])

  const updateFieldFn = useCallback(async (fieldId: string, updates: UpdateCustomFieldInput): Promise<boolean> => {
    if (!projectId) return false

    try {
      const field = await updateCustomField(projectId, fieldId, updates)
      setFields((prev) => prev.map((f) => (f.id === fieldId ? field : f)))
      return true
    } catch {
      return false
    }
  }, [projectId])

  const deleteFieldFn = useCallback(async (fieldId: string): Promise<boolean> => {
    if (!projectId) return false

    try {
      await deleteCustomField(projectId, fieldId)
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
      createField: createFieldFn,
      updateField: updateFieldFn,
      deleteField: deleteFieldFn,
    }),
    [fields, isLoading, error, fetchFields, createFieldFn, updateFieldFn, deleteFieldFn]
  )
}
