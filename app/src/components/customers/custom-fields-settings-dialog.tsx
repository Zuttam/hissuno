'use client'

import { useState, useCallback, type ChangeEvent } from 'react'
import { Button, Input, Select, IconButton, FormField } from '@/components/ui'
import { useCustomFields } from '@/hooks/use-custom-fields'
import type { CustomerEntityType, CustomFieldType, CustomFieldDefinition } from '@/types/customer'
import { CUSTOM_FIELD_TYPES } from '@/types/customer'

const MAX_FIELDS = 10
const MAX_LABEL_LENGTH = 50

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  boolean: 'Yes/No',
  select: 'Select',
}

interface FieldFormState {
  label: string
  type: CustomFieldType
  options: string
  required: boolean
}

const EMPTY_FORM: FieldFormState = {
  label: '',
  type: 'text',
  options: '',
  required: false,
}

interface FieldFormProps {
  formState: FieldFormState
  onLabelChange: (e: ChangeEvent<HTMLInputElement>) => void
  onTypeChange: (e: ChangeEvent<HTMLSelectElement>) => void
  onOptionsChange: (e: ChangeEvent<HTMLInputElement>) => void
  onRequiredChange: (e: ChangeEvent<HTMLInputElement>) => void
  formError: string | null
}

function FieldForm({
  formState,
  onLabelChange,
  onTypeChange,
  onOptionsChange,
  onRequiredChange,
  formError,
}: FieldFormProps) {
  return (
    <div className="space-y-4">
      {formError && (
        <div className="rounded-md bg-[color:var(--background-danger)] p-2 text-xs text-[color:var(--text-danger)]">
          {formError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <FormField label="Label">
          <Input
            value={formState.label}
            onChange={onLabelChange}
            placeholder="e.g. Contract Value"
            maxLength={MAX_LABEL_LENGTH}
          />
        </FormField>

        <FormField label="Type">
          <Select value={formState.type} onChange={onTypeChange}>
            {CUSTOM_FIELD_TYPES.map((t) => (
              <option key={t} value={t}>
                {FIELD_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      {formState.type === 'select' && (
        <FormField label="Options" description="Comma-separated list of options">
          <Input
            value={formState.options}
            onChange={onOptionsChange}
            placeholder="Option A, Option B, Option C"
          />
        </FormField>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="field-required"
          checked={formState.required}
          onChange={onRequiredChange}
          className="h-4 w-4 rounded border-[color:var(--border)] accent-[color:var(--accent-selected)]"
        />
        <label htmlFor="field-required" className="text-xs text-[color:var(--text-secondary)]">
          Required
        </label>
      </div>
    </div>
  )
}

interface FieldsEditorProps {
  projectId: string
  entityType: CustomerEntityType
}

export function FieldsEditor({ projectId, entityType }: FieldsEditorProps) {
  const { fields, isLoading, createField, updateField, deleteField } = useCustomFields({
    projectId,
    entityType,
  })

  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formState, setFormState] = useState<FieldFormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const handleStartAdd = useCallback(() => {
    setIsAdding(true)
    setEditingId(null)
    setFormState(EMPTY_FORM)
    setFormError(null)
  }, [])

  const handleStartEdit = useCallback((field: CustomFieldDefinition) => {
    setIsAdding(false)
    setEditingId(field.id)
    setFormState({
      label: field.field_label,
      type: field.field_type,
      options: field.field_type === 'select' && field.select_options ? field.select_options.join(', ') : '',
      required: field.is_required,
    })
    setFormError(null)
  }, [])

  const handleCancel = useCallback(() => {
    setIsAdding(false)
    setEditingId(null)
    setFormState(EMPTY_FORM)
    setFormError(null)
  }, [])

  const handleLabelChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const label = e.target.value.substring(0, MAX_LABEL_LENGTH)
    setFormState((prev) => ({ ...prev, label }))
  }, [])

  const handleTypeChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setFormState((prev) => ({ ...prev, type: e.target.value as CustomFieldType }))
  }, [])

  const handleOptionsChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFormState((prev) => ({ ...prev, options: e.target.value }))
  }, [])

  const handleRequiredChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    setFormState((prev) => ({ ...prev, required: e.target.checked }))
  }, [])

  const generateFieldKey = (label: string): string =>
    label
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')

  const validateForm = useCallback((): string | null => {
    if (!formState.label.trim()) {
      return 'Label is required.'
    }
    const fieldKey = generateFieldKey(formState.label)
    if (!fieldKey) {
      return 'Label must contain at least one alphanumeric character.'
    }
    // Check for duplicate field_keys (skip the field being edited)
    const duplicate = fields.find((f) => f.field_key === fieldKey && f.id !== editingId)
    if (duplicate) {
      return 'A field with this key already exists.'
    }
    if (formState.type === 'select') {
      const options = formState.options
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean)
      if (options.length < 2) {
        return 'Select type requires at least 2 options.'
      }
    }
    return null
  }, [formState, fields, editingId])

  const handleSave = useCallback(async () => {
    const validationError = validateForm()
    if (validationError) {
      setFormError(validationError)
      return
    }

    setIsSaving(true)
    setFormError(null)

    const fieldKey = generateFieldKey(formState.label)
    const selectOptions =
      formState.type === 'select'
        ? formState.options
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined

    if (isAdding) {
      const result = await createField({
        project_id: projectId,
        entity_type: entityType,
        field_key: fieldKey,
        field_label: formState.label.trim(),
        field_type: formState.type,
        select_options: selectOptions,
        is_required: formState.required,
      })

      setIsSaving(false)

      if (result) {
        handleCancel()
      } else {
        setFormError('Failed to create field. You may have reached the maximum of 10 fields.')
      }
    } else if (editingId) {
      const success = await updateField(editingId, {
        field_label: formState.label.trim(),
        field_type: formState.type,
        select_options: selectOptions,
        is_required: formState.required,
      })

      setIsSaving(false)

      if (success) {
        handleCancel()
      } else {
        setFormError('Failed to update field.')
      }
    }
  }, [validateForm, isAdding, editingId, formState, projectId, entityType, createField, updateField, handleCancel])

  const handleDelete = useCallback(
    async (field: CustomFieldDefinition) => {
      if (!confirm(`Delete "${field.field_label}"? This cannot be undone.`)) {
        return
      }
      await deleteField(field.id)
    },
    [deleteField]
  )

  const isEditing = isAdding || editingId !== null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-sm text-[color:var(--text-secondary)]">Loading...</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Fields list */}
      <div className="space-y-1">
        {fields.map((field) => (
          <div
            key={field.id}
            className="flex items-center gap-3 rounded-lg bg-[color:var(--background-secondary)] p-2"
          >
            {editingId === field.id ? (
              <div className="flex-1 space-y-4 py-1">
                <FieldForm
                  formState={formState}
                  onLabelChange={handleLabelChange}
                  onTypeChange={handleTypeChange}
                  onOptionsChange={handleOptionsChange}
                  onRequiredChange={handleRequiredChange}
                  formError={formError}
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => void handleSave()} loading={isSaving}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <span className="text-sm text-[color:var(--foreground)]">{field.field_label}</span>
                  <span className="rounded bg-[color:var(--background-secondary)] px-1.5 py-0.5 text-xs text-[color:var(--text-secondary)]">
                    {FIELD_TYPE_LABELS[field.field_type]}
                  </span>
                  {field.field_type === 'select' && field.select_options && (
                    <span className="text-xs text-[color:var(--text-tertiary)]">
                      {field.select_options.length} options
                    </span>
                  )}
                  {field.is_required && (
                    <span className="text-xs text-[color:var(--text-tertiary)]">Required</span>
                  )}
                </div>
                <div className="flex shrink-0 gap-1">
                  <IconButton
                    size="sm"
                    aria-label="Edit field"
                    onClick={() => handleStartEdit(field)}
                    disabled={isEditing}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </IconButton>
                  <IconButton
                    size="sm"
                    aria-label="Delete field"
                    onClick={() => void handleDelete(field)}
                    disabled={isEditing}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </IconButton>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      {fields.length === 0 && !isAdding && (
        <p className="py-4 text-center text-sm text-[color:var(--text-secondary)]">
          No custom fields defined yet.
        </p>
      )}

      {/* Add new field form */}
      {isAdding && (
        <div className="space-y-4">
          <FieldForm
            formState={formState}
            onLabelChange={handleLabelChange}
            onTypeChange={handleTypeChange}
            onOptionsChange={handleOptionsChange}
            onRequiredChange={handleRequiredChange}
            formError={formError}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={() => void handleSave()} loading={isSaving}>
              Add Field
            </Button>
          </div>
        </div>
      )}

      {/* Footer: add button + counter */}
      {!isEditing && (
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleStartAdd}
            disabled={fields.length >= MAX_FIELDS}
          >
            + Add Custom Field
          </Button>
          <span className="text-xs text-[color:var(--text-tertiary)]">
            {fields.length} / {MAX_FIELDS} fields
          </span>
        </div>
      )}

      {fields.length >= MAX_FIELDS && !isEditing && (
        <p className="text-xs text-[color:var(--text-tertiary)]">
          Maximum of {MAX_FIELDS} custom fields reached.
        </p>
      )}
    </div>
  )
}
