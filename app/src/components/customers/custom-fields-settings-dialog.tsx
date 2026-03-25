'use client'

import { useState, useCallback, type ChangeEvent } from 'react'
import { Button, Input, Select, IconButton, FormField } from '@/components/ui'
import { useCustomFields } from '@/hooks/use-custom-fields'
import type { CustomerEntityType, CustomFieldType, CustomFieldDefinition } from '@/types/customer'
import { CUSTOM_FIELD_TYPES } from '@/types/customer'
import {
  Type, Hash, Calendar, Check, ChevronDown, Link, List, Tag, AlertCircle,
  type LucideIcon,
} from 'lucide-react'

const MAX_FIELDS = 10
const MAX_LABEL_LENGTH = 50

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  boolean: 'Yes/No',
  select: 'Select',
}

const FIELD_TYPE_ICONS: Record<string, LucideIcon> = {
  text: Type,
  number: Hash,
  date: Calendar,
  'yes/no': Check,
  boolean: Check,
  select: ChevronDown,
  relation: Link,
  'multi-select': List,
  tag: Tag,
}

export function FieldTypeIcon({ type, className = '' }: { type: string; className?: string }) {
  const Icon = FIELD_TYPE_ICONS[type.toLowerCase()] ?? AlertCircle
  return <Icon size={12} className={`shrink-0 ${className}`} />
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

export interface BuiltInField {
  label: string
  type: string
}

interface FieldsEditorProps {
  projectId: string
  entityType: CustomerEntityType
  builtInFields?: BuiltInField[]
  title?: string
}

export function FieldsEditor({ projectId, entityType, builtInFields = [], title }: FieldsEditorProps) {
  const { fields, isLoading, createField, updateField, deleteField } = useCustomFields({
    projectId,
    entityType,
  })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [formState, setFormState] = useState<FieldFormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [addLabel, setAddLabel] = useState('')
  const [addType, setAddType] = useState<CustomFieldType>('text')

  const handleStartEdit = useCallback((field: CustomFieldDefinition) => {
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
    setEditingId(null)
    setFormState(EMPTY_FORM)
    setFormError(null)
  }, [])

  const generateFieldKey = (label: string): string =>
    label.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')

  const handleInlineAdd = useCallback(async () => {
    const label = addLabel.trim()
    if (!label) return
    const fieldKey = generateFieldKey(label)
    if (!fieldKey) return

    const duplicate = fields.find((f) => f.field_key === fieldKey)
    if (duplicate) {
      setFormError('A field with this key already exists.')
      return
    }

    setIsSaving(true)
    setFormError(null)

    const result = await createField({
      project_id: projectId,
      entity_type: entityType,
      field_key: fieldKey,
      field_label: label,
      field_type: addType,
    })

    setIsSaving(false)

    if (result) {
      setAddLabel('')
      setAddType('text')
      setIsAddOpen(false)
    } else {
      setFormError('Failed to create field.')
    }
  }, [addLabel, addType, fields, projectId, entityType, createField])

  const handleEditSave = useCallback(async () => {
    if (!editingId) return
    if (!formState.label.trim()) {
      setFormError('Label is required.')
      return
    }

    const fieldKey = generateFieldKey(formState.label)
    if (!fieldKey) {
      setFormError('Label must contain at least one alphanumeric character.')
      return
    }
    const duplicate = fields.find((f) => f.field_key === fieldKey && f.id !== editingId)
    if (duplicate) {
      setFormError('A field with this key already exists.')
      return
    }
    if (formState.type === 'select') {
      const options = formState.options.split(',').map((o) => o.trim()).filter(Boolean)
      if (options.length < 2) {
        setFormError('Select type requires at least 2 options.')
        return
      }
    }

    setIsSaving(true)
    setFormError(null)

    const selectOptions =
      formState.type === 'select'
        ? formState.options.split(',').map((o) => o.trim()).filter(Boolean)
        : undefined

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
  }, [editingId, formState, fields, updateField, handleCancel])

  const handleDelete = useCallback(
    async (field: CustomFieldDefinition) => {
      if (!confirm(`Delete "${field.field_label}"? This cannot be undone.`)) return
      await deleteField(field.id)
    },
    [deleteField]
  )

  const canAdd = fields.length < MAX_FIELDS && editingId === null

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4">
        <span className="text-xs text-[color:var(--text-secondary)]">Loading...</span>
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {/* Title */}
      {title && (
        <div className="pb-1">
          <span className="font-mono text-base font-semibold uppercase">{title}</span>
        </div>
      )}

      {/* Built-in fields (readonly) */}
      {builtInFields.map((field) => (
        <div
          key={field.label}
          className="flex items-center gap-2 px-2 py-1.5"
        >
          <span className="text-sm text-[color:var(--text-secondary)]">{field.label}</span>
          <div className="ml-auto flex shrink-0 items-center gap-1.5 text-[color:var(--text-tertiary)]">
            <FieldTypeIcon type={field.type} />
            <span className="text-xs">{field.type}</span>
          </div>
        </div>
      ))}

      {/* Custom fields (editable) */}
      {fields.map((field) => (
        <div key={field.id}>
          {editingId === field.id ? (
            <div className="rounded-md border border-[color:var(--border-subtle)] p-3 space-y-3">
              {formError && (
                <div className="rounded-md bg-[color:var(--background-danger)] p-2 text-xs text-[color:var(--text-danger)]">
                  {formError}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Label">
                  <Input
                    value={formState.label}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setFormState((prev) => ({ ...prev, label: e.target.value.substring(0, MAX_LABEL_LENGTH) }))
                    }
                    maxLength={MAX_LABEL_LENGTH}
                  />
                </FormField>
                <FormField label="Type">
                  <Select
                    value={formState.type}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setFormState((prev) => ({ ...prev, type: e.target.value as CustomFieldType }))
                    }
                  >
                    {CUSTOM_FIELD_TYPES.map((t) => (
                      <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
                    ))}
                  </Select>
                </FormField>
              </div>
              {formState.type === 'select' && (
                <FormField label="Options" description="Comma-separated">
                  <Input
                    value={formState.options}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setFormState((prev) => ({ ...prev, options: e.target.value }))
                    }
                    placeholder="Option A, Option B"
                  />
                </FormField>
              )}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id={`field-required-${field.id}`}
                    checked={formState.required}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setFormState((prev) => ({ ...prev, required: e.target.checked }))
                    }
                    className="h-3.5 w-3.5 rounded border-[color:var(--border)] accent-[color:var(--accent-selected)]"
                  />
                  <label htmlFor={`field-required-${field.id}`} className="text-xs text-[color:var(--text-secondary)]">
                    Required
                  </label>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={handleCancel}>Cancel</Button>
                  <Button size="sm" onClick={() => void handleEditSave()} loading={isSaving}>Save</Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-[color:var(--background-secondary)] group">
              <span className="text-sm text-[color:var(--foreground)] min-w-0 truncate">{field.field_label}</span>
              {field.is_required && (
                <span className="shrink-0 text-xs text-[color:var(--text-tertiary)]">*</span>
              )}
              <div className="ml-auto flex shrink-0 items-center gap-1.5 text-[color:var(--text-tertiary)]">
                <FieldTypeIcon type={field.field_type} />
                <span className="text-xs">{FIELD_TYPE_LABELS[field.field_type]}</span>
              </div>
              <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
                <IconButton
                  size="sm"
                  aria-label="Edit field"
                  onClick={() => handleStartEdit(field)}
                  disabled={editingId !== null}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                  </svg>
                </IconButton>
                <IconButton
                  size="sm"
                  aria-label="Delete field"
                  onClick={() => void handleDelete(field)}
                  disabled={editingId !== null}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                  </svg>
                </IconButton>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Add custom field */}
      {canAdd && !isAddOpen && (
        <div className="flex items-center justify-between pt-1">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => setIsAddOpen(true)}
          >
            + Add Custom Field
          </Button>
          <span className="text-xs text-[color:var(--text-tertiary)]">
            {fields.length} / {MAX_FIELDS} fields
          </span>
        </div>
      )}

      {canAdd && isAddOpen && (
        <div className="flex items-center gap-2 px-2 py-1">
          <input
            value={addLabel}
            onChange={(e) => setAddLabel(e.target.value.substring(0, MAX_LABEL_LENGTH))}
            placeholder="Field name"
            maxLength={MAX_LABEL_LENGTH}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && addLabel.trim()) void handleInlineAdd()
              if (e.key === 'Escape') { setIsAddOpen(false); setAddLabel(''); setFormError(null) }
            }}
            autoFocus
            className="flex-1 bg-transparent border-b border-[color:var(--border-subtle)] px-0.5 py-0.5 text-sm text-[color:var(--foreground)] placeholder:text-[color:var(--text-tertiary)] focus:border-[color:var(--accent-primary)] focus:outline-none"
          />
          <div className="relative flex shrink-0 items-center text-[color:var(--text-tertiary)]">
            <FieldTypeIcon type={addType} className="pointer-events-none" />
            <select
              value={addType}
              onChange={(e) => setAddType(e.target.value as CustomFieldType)}
              className="ml-1 appearance-none bg-transparent py-0.5 pr-3.5 text-xs text-[color:var(--text-secondary)] focus:outline-none cursor-pointer"
            >
              {CUSTOM_FIELD_TYPES.map((t) => (
                <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>
              ))}
            </select>
            <svg className="pointer-events-none absolute right-0 h-3 w-3 text-[color:var(--text-tertiary)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </div>
          <button
            type="button"
            onClick={() => void handleInlineAdd()}
            disabled={!addLabel.trim() || isSaving}
            className="rounded-[4px] p-0.5 text-[color:var(--accent-success)] transition hover:bg-[color:var(--surface-hover)] disabled:opacity-30"
            aria-label="Add field"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => { setIsAddOpen(false); setAddLabel(''); setFormError(null) }}
            className="rounded-[4px] p-0.5 text-[color:var(--accent-danger)] transition hover:bg-[color:var(--surface-hover)]"
            aria-label="Cancel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

      {/* Inline error for add */}
      {formError && editingId === null && (
        <div className="px-2 text-xs text-[color:var(--text-danger)]">{formError}</div>
      )}
    </div>
  )
}
