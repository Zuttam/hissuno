'use client'

import { useState, useCallback } from 'react'
import { Button, Input, Select } from '@/components/ui'
import { useCustomFields } from '@/hooks/use-custom-fields'
import type { CustomerEntityType, CustomFieldType, CustomFieldDefinition } from '@/types/customer'
import { CUSTOM_FIELD_TYPES } from '@/types/customer'

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  text: 'Text',
  number: 'Number',
  date: 'Date',
  boolean: 'Yes/No',
  select: 'Select',
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

  const [showAddForm, setShowAddForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newType, setNewType] = useState<CustomFieldType>('text')
  const [newOptions, setNewOptions] = useState('')
  const [newRequired, setNewRequired] = useState(false)
  const [isAdding, setIsAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleAdd = useCallback(async () => {
    if (!newLabel.trim()) {
      setError('Label is required.')
      return
    }

    const fieldKey = newLabel
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')

    if (!fieldKey) {
      setError('Label must contain at least one alphanumeric character.')
      return
    }

    setIsAdding(true)
    setError(null)

    const selectOptions =
      newType === 'select'
        ? newOptions
            .split(',')
            .map((o) => o.trim())
            .filter(Boolean)
        : undefined

    const success = await createField({
      project_id: projectId,
      entity_type: entityType,
      field_key: fieldKey,
      field_label: newLabel.trim(),
      field_type: newType,
      select_options: selectOptions,
      is_required: newRequired,
    })

    setIsAdding(false)

    if (success) {
      setNewLabel('')
      setNewType('text')
      setNewOptions('')
      setNewRequired(false)
      setShowAddForm(false)
    } else {
      setError('Failed to create field. You may have reached the maximum of 10 fields.')
    }
  }, [projectId, entityType, newLabel, newType, newOptions, newRequired, createField])

  const handleDelete = useCallback(
    async (fieldId: string) => {
      await deleteField(fieldId)
    },
    [deleteField]
  )

  const handleToggleRequired = useCallback(
    async (field: CustomFieldDefinition) => {
      await updateField(field.id, { is_required: !field.is_required })
    },
    [updateField]
  )

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <span className="text-sm text-[color:var(--text-secondary)]">Loading...</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-[color:var(--text-secondary)]">
          {fields.length} / 10 custom fields defined for {entityType === 'company' ? 'companies' : 'contacts'}.
        </p>
        {fields.length < 10 && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setShowAddForm(!showAddForm)}
          >
            {showAddForm ? 'Cancel' : 'Add Field'}
          </Button>
        )}
      </div>

      {error && (
        <div className="rounded-[4px] bg-red-500/10 px-3 py-2 text-xs text-red-600">{error}</div>
      )}

      {/* Add form */}
      {showAddForm && (
        <div className="rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] p-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[color:var(--text-secondary)]">Label</label>
              <Input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Contract Value"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[color:var(--text-secondary)]">Type</label>
              <Select value={newType} onChange={(e) => setNewType(e.target.value as CustomFieldType)}>
                {CUSTOM_FIELD_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {FIELD_TYPE_LABELS[t]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {newType === 'select' && (
            <div className="mt-3 flex flex-col gap-1">
              <label className="text-xs font-medium text-[color:var(--text-secondary)]">
                Options (comma-separated)
              </label>
              <Input
                type="text"
                value={newOptions}
                onChange={(e) => setNewOptions(e.target.value)}
                placeholder="Option A, Option B, Option C"
              />
            </div>
          )}

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="new-field-required"
                checked={newRequired}
                onChange={(e) => setNewRequired(e.target.checked)}
                className="h-4 w-4 rounded border-[color:var(--border)] accent-[color:var(--accent-selected)]"
              />
              <label htmlFor="new-field-required" className="text-xs text-[color:var(--text-secondary)]">
                Required
              </label>
            </div>
            <Button size="sm" onClick={() => void handleAdd()} loading={isAdding}>
              Create Field
            </Button>
          </div>
        </div>
      )}

      {/* Fields list */}
      {fields.length > 0 ? (
        <div className="rounded-[4px] border border-[color:var(--border-subtle)]">
          <table className="w-full font-mono text-xs">
            <thead>
              <tr className="border-b border-[color:var(--border-subtle)]">
                <th className="px-3 py-2 text-left text-[color:var(--text-secondary)]">Label</th>
                <th className="px-3 py-2 text-left text-[color:var(--text-secondary)]">Key</th>
                <th className="px-3 py-2 text-left text-[color:var(--text-secondary)]">Type</th>
                <th className="px-3 py-2 text-center text-[color:var(--text-secondary)]">Required</th>
                <th className="w-20 px-3 py-2">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {fields.map((field) => (
                <tr key={field.id} className="border-b border-[color:var(--border-subtle)]">
                  <td className="px-3 py-2 text-[color:var(--foreground)]">{field.field_label}</td>
                  <td className="px-3 py-2 text-[color:var(--text-secondary)]">{field.field_key}</td>
                  <td className="px-3 py-2 text-[color:var(--text-secondary)]">
                    {FIELD_TYPE_LABELS[field.field_type]}
                    {field.field_type === 'select' && field.select_options && (
                      <span className="ml-1 text-[color:var(--text-tertiary)]">
                        ({field.select_options.length})
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => void handleToggleRequired(field)}
                      className="text-[color:var(--text-secondary)] transition hover:text-[color:var(--foreground)]"
                    >
                      {field.is_required ? 'Yes' : 'No'}
                    </button>
                  </td>
                  <td className="px-3 py-2 text-center">
                    <button
                      type="button"
                      onClick={() => void handleDelete(field.id)}
                      className="rounded-[4px] p-1 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--accent-danger)]"
                      aria-label={`Delete ${field.field_label}`}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
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
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="py-4 text-center text-sm text-[color:var(--text-secondary)]">
          No custom fields defined yet.
        </p>
      )}
    </div>
  )
}
