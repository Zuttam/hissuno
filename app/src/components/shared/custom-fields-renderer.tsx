'use client'

import { useState, useCallback, useMemo, useRef } from 'react'
import { Input, Select } from '@/components/ui'
import { FieldTypeIcon } from '@/components/customers/custom-fields-settings-dialog'
import type { CustomFieldDefinition } from '@/types/ontology'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CustomFieldsRendererProps {
  fields: CustomFieldDefinition[]
  values: Record<string, unknown>
  onChange: (key: string, value: unknown) => void
  readonly?: boolean
}

// ---------------------------------------------------------------------------
// Multi-select chip editor
// ---------------------------------------------------------------------------

function MultiSelectField({
  field,
  value,
  onChange,
  readonly,
}: {
  field: CustomFieldDefinition
  value: string[]
  onChange: (value: string[]) => void
  readonly?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)
  const options = field.select_options ?? []
  const available = useMemo(
    () => options.filter((opt) => !value.includes(opt)),
    [options, value]
  )

  const handleAdd = useCallback(
    (opt: string) => {
      onChange([...value, opt])
      setIsOpen(false)
    },
    [value, onChange]
  )

  const handleRemove = useCallback(
    (opt: string) => {
      onChange(value.filter((v) => v !== opt))
    },
    [value, onChange]
  )

  return (
    <div className="flex flex-wrap items-center gap-1">
      {value.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 rounded-[4px] bg-[color:var(--surface-hover)] px-1.5 py-0.5 text-[10px] font-medium text-[color:var(--foreground)]"
        >
          {v}
          {!readonly && (
            <button
              type="button"
              onClick={() => handleRemove(v)}
              className="ml-0.5 text-[color:var(--text-tertiary)] hover:text-[color:var(--foreground)]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </span>
      ))}
      {!readonly && available.length > 0 && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="inline-flex items-center gap-0.5 rounded-[4px] border border-dashed border-[color:var(--border-subtle)] px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[color:var(--text-tertiary)] transition hover:border-[color:var(--border)] hover:text-[color:var(--text-secondary)]"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Add
          </button>
          {isOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 min-w-[140px] max-h-[200px] overflow-y-auto rounded-[4px] border border-[color:var(--border)] bg-[color:var(--surface)] py-1 shadow-lg">
                {available.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => handleAdd(opt)}
                    className="flex w-full items-center px-3 py-1.5 text-left text-xs hover:bg-[color:var(--surface-hover)]"
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
      {value.length === 0 && readonly && (
        <span className="text-xs text-[color:var(--text-tertiary)]">-</span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Single field renderer
// ---------------------------------------------------------------------------

function BlurSaveInput({
  type = 'text',
  initialValue,
  onChange,
  className,
}: {
  type?: 'text' | 'number' | 'date'
  initialValue: string
  onChange: (value: unknown) => void
  className?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  const [localValue, setLocalValue] = useState(initialValue)
  // Sync from parent when external value changes
  const prevInitial = useRef(initialValue)
  if (prevInitial.current !== initialValue) {
    prevInitial.current = initialValue
    setLocalValue(initialValue)
  }

  const handleBlur = useCallback(() => {
    if (localValue === initialValue) return
    if (type === 'number') {
      onChange(localValue ? Number(localValue) : null)
    } else {
      onChange(localValue || null)
    }
  }, [localValue, initialValue, onChange, type])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') ref.current?.blur()
  }, [])

  return (
    <Input
      ref={ref}
      type={type}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={className}
    />
  )
}

function CustomFieldInput({
  field,
  value,
  onChange,
  readonly,
}: {
  field: CustomFieldDefinition
  value: unknown
  onChange: (value: unknown) => void
  readonly?: boolean
}) {
  switch (field.field_type) {
    case 'text':
      return readonly ? (
        <span className="text-xs text-[color:var(--foreground)]">{(value as string) || '-'}</span>
      ) : (
        <BlurSaveInput
          initialValue={(value as string) ?? ''}
          onChange={onChange}
          className="h-7 text-xs"
        />
      )

    case 'number':
      return readonly ? (
        <span className="text-xs text-[color:var(--foreground)]">{value != null ? String(value) : '-'}</span>
      ) : (
        <BlurSaveInput
          type="number"
          initialValue={value != null ? String(value) : ''}
          onChange={onChange}
          className="h-7 text-xs"
        />
      )

    case 'date':
      return readonly ? (
        <span className="text-xs text-[color:var(--foreground)]">{(value as string) || '-'}</span>
      ) : (
        <BlurSaveInput
          type="date"
          initialValue={(value as string) ?? ''}
          onChange={onChange}
          className="h-7 text-xs"
        />
      )

    case 'boolean':
      return (
        <input
          type="checkbox"
          checked={!!value}
          onChange={(e) => onChange(e.target.checked)}
          disabled={readonly}
          className="h-3.5 w-3.5 rounded border-[color:var(--border)] accent-[color:var(--accent-selected)]"
        />
      )

    case 'select':
      return readonly ? (
        <span className="text-xs text-[color:var(--foreground)]">{(value as string) || '-'}</span>
      ) : (
        <Select
          value={(value as string) ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-7 text-xs"
        >
          <option value="">-</option>
          {(field.select_options ?? []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </Select>
      )

    case 'multi_select':
      return (
        <MultiSelectField
          field={field}
          value={Array.isArray(value) ? value : []}
          onChange={onChange}
          readonly={readonly}
        />
      )

    default:
      return <span className="text-xs text-[color:var(--text-tertiary)]">-</span>
  }
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CustomFieldsRenderer({ fields, values, onChange, readonly }: CustomFieldsRendererProps) {
  if (fields.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      {fields.map((field) => (
        <div key={field.id} className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5">
            <FieldTypeIcon type={field.field_type} className="text-[color:var(--text-tertiary)]" />
            <label className="font-mono text-[10px] uppercase tracking-wide text-[color:var(--text-secondary)]">
              {field.field_label}
              {field.is_required && <span className="ml-0.5 text-[color:var(--accent-danger)]">*</span>}
            </label>
          </div>
          <CustomFieldInput
            field={field}
            value={values[field.field_key] ?? null}
            onChange={(v) => onChange(field.field_key, v)}
            readonly={readonly}
          />
        </div>
      ))}
    </div>
  )
}
