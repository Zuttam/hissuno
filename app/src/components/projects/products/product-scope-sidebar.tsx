'use client'

import { useState, useCallback, useEffect, useMemo, useRef, type ChangeEvent } from 'react'
import { LayoutGrid, Rocket } from 'lucide-react'
import { Button, Dialog, Input, Textarea, Badge, FormField, Select } from '@/components/ui'
import { RelatedEntitiesSection } from '@/components/shared/related-entities-section'
import { CustomFieldsRenderer } from '@/components/shared/custom-fields-renderer'
import { useCustomFields } from '@/hooks/use-custom-fields'
import type { ProductScopeRecord, ProductScopeType, ProductScopeGoal } from '@/types/product-scope'
import type { TagColorVariant } from '@/types/session'
import { generateSlugFromName } from '@/lib/security/sanitize'

const MAX_NAME_LENGTH = 50
const MAX_DESCRIPTION_LENGTH = 500
const MAX_GOAL_LENGTH = 200

const COLOR_OPTIONS: { value: TagColorVariant; label: string; colorClass: string }[] = [
  { value: 'info', label: 'Blue', colorClass: 'bg-blue-500' },
  { value: 'success', label: 'Green', colorClass: 'bg-green-500' },
  { value: 'warning', label: 'Yellow', colorClass: 'bg-yellow-500' },
  { value: 'danger', label: 'Red', colorClass: 'bg-red-500' },
  { value: 'default', label: 'Gray', colorClass: 'bg-gray-500' },
]

const TYPE_OPTIONS: { value: ProductScopeType; label: string }[] = [
  { value: 'product_area', label: 'Product Area' },
  { value: 'initiative', label: 'Initiative' },
]

// ============================================================================
// Type Icons
// ============================================================================

export function ScopeTypeIcon({ type, size = 14 }: { type: ProductScopeType; size?: number }) {
  if (type === 'initiative') {
    return <Rocket size={size} className="text-[color:var(--accent-warning)]" />
  }
  return <LayoutGrid size={size} className="text-[color:var(--accent-info)]" />
}

// ============================================================================
// Props
// ============================================================================

interface ProductScopeSidebarEditProps {
  scope: ProductScopeRecord
  projectId: string
  onClose: () => void
  onUpdate: (updates: Record<string, unknown>) => Promise<boolean>
  onDelete: (scopeId: string) => void
}

interface ProductScopeSidebarCreateProps {
  projectId: string
  onClose: () => void
  onCreate: (newScope: {
    name: string
    slug: string
    description: string
    color: TagColorVariant
    type: ProductScopeType
    goals: ProductScopeGoal[] | null
    custom_fields?: Record<string, unknown>
  }) => void
  existingSlugs: string[]
}

export type ProductScopeSidebarProps = ProductScopeSidebarEditProps | ProductScopeSidebarCreateProps

function isCreateMode(props: ProductScopeSidebarProps): props is ProductScopeSidebarCreateProps {
  return !('scope' in props)
}

export function ProductScopeSidebar(props: ProductScopeSidebarProps) {
  if (isCreateMode(props)) {
    return <CreateModeSidebar {...props} />
  }
  return <EditModeSidebar {...props} />
}

// ============================================================================
// Edit Mode Sidebar (per-field inline editing)
// ============================================================================

function EditModeSidebar({
  scope,
  projectId,
  onClose,
  onUpdate,
  onDelete,
}: ProductScopeSidebarEditProps) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<'type' | 'color' | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const dropdownContainerRef = useRef<HTMLDivElement>(null)

  const { fields: customFields } = useCustomFields({
    projectId,
    entityType: 'product_scope',
  })

  const selectedColor = useMemo(() => COLOR_OPTIONS.find((c) => c.value === scope.color), [scope.color])

  const handleCustomFieldChange = useCallback((key: string, value: unknown) => {
    const currentFields = (scope.custom_fields as Record<string, unknown>) ?? {}
    void onUpdate({ custom_fields: { ...currentFields, [key]: value } })
  }, [scope.custom_fields, onUpdate])

  // Close dropdown on click outside or Escape
  useEffect(() => {
    if (!openDropdown) return
    function handlePointerDown(event: PointerEvent) {
      if (!dropdownContainerRef.current?.contains(event.target as Node)) {
        setOpenDropdown(null)
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpenDropdown(null)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [openDropdown])

  const handleFieldSave = useCallback(async (fieldKey: string, newValue: string): Promise<boolean> => {
    setIsSaving(true)
    const updates: Record<string, unknown> = { [fieldKey]: newValue || '' }
    if (fieldKey === 'name' && newValue.trim()) {
      updates.slug = generateSlugFromName(newValue.trim())
    }
    const ok = await onUpdate(updates)
    setIsSaving(false)
    return ok
  }, [onUpdate])

  const handleTypeSelect = useCallback(async (newType: ProductScopeType) => {
    setIsSaving(true)
    await onUpdate({ type: newType })
    setIsSaving(false)
    setOpenDropdown(null)
  }, [onUpdate])

  const handleColorSelect = useCallback(async (newColor: TagColorVariant) => {
    setIsSaving(true)
    await onUpdate({ color: newColor })
    setIsSaving(false)
    setOpenDropdown(null)
  }, [onUpdate])

  const handleGoalsSave = useCallback(async (newGoals: ProductScopeGoal[]): Promise<boolean> => {
    setIsSaving(true)
    const filtered = newGoals.filter((g) => g.text.trim())
    const ok = await onUpdate({ goals: filtered.length > 0 ? filtered : null })
    setIsSaving(false)
    return ok
  }, [onUpdate])

  const handleDelete = useCallback(() => {
    onDelete(scope.id)
    setShowDeleteConfirm(false)
    onClose()
  }, [scope.id, onDelete, onClose])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden="true" />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] shadow-xl">
        {/* Header */}
        <div className="shrink-0 border-b-2 border-[color:var(--border-subtle)] p-4">
          {/* Row 1: Label + close */}
          <div className="flex items-center justify-between">
            <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
              Scope
            </span>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[4px] p-2 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
              aria-label="Close sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Row 2: Name badge (inline editable for non-default) */}
          <EditableName
            name={scope.name}
            color={scope.color}
            isDefault={scope.is_default}
            onSave={(newName) => handleFieldSave('name', newName)}
          />

          {/* Row 3: Description (editable in header) */}
          <div className="mt-2">
            <EditableTextField
              value={scope.description}
              fieldKey="description"
              onSave={handleFieldSave}
              placeholder="Add a description..."
              type="textarea"
              maxLength={MAX_DESCRIPTION_LENGTH}
            />
          </div>

          {/* Row 4: Inline metadata buttons (type, color, delete) */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5" ref={dropdownContainerRef}>
            {/* Type dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => !scope.is_default && setOpenDropdown((prev) => (prev === 'type' ? null : 'type'))}
                className={`inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs transition ${
                  scope.is_default
                    ? 'text-[color:var(--text-tertiary)] cursor-default'
                    : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]'
                }`}
              >
                <ScopeTypeIcon type={scope.type} />
                <span>{TYPE_OPTIONS.find((o) => o.value === scope.type)?.label ?? scope.type}</span>
              </button>
              {openDropdown === 'type' && (
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[200px] rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)] p-3 shadow-lg">
                  <span className="mb-2 block font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
                    Type
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {TYPE_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => void handleTypeSelect(option.value)}
                        disabled={isSaving}
                        className="flex items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-sm transition hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
                      >
                        <ScopeTypeIcon type={option.value} size={12} />
                        <span className={scope.type === option.value ? 'font-medium text-[color:var(--foreground)]' : 'text-[color:var(--text-secondary)]'}>
                          {option.label}
                        </span>
                        {scope.type === option.value && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-[color:var(--accent-primary)]">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Color dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setOpenDropdown((prev) => (prev === 'color' ? null : 'color'))}
                className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
              >
                <span className={`inline-block h-3 w-3 rounded-full ${selectedColor?.colorClass ?? 'bg-gray-500'}`} />
                <span>{selectedColor?.label ?? 'Color'}</span>
              </button>
              {openDropdown === 'color' && (
                <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)] p-3 shadow-lg">
                  <span className="mb-2 block font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
                    Color
                  </span>
                  <div className="flex flex-col gap-0.5">
                    {COLOR_OPTIONS.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => void handleColorSelect(option.value)}
                        disabled={isSaving}
                        className="flex items-center gap-2 rounded-[4px] px-2 py-1.5 text-left text-sm transition hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
                      >
                        <span className={`inline-block h-3 w-3 rounded-full ${option.colorClass}`} />
                        <span className={scope.color === option.value ? 'font-medium text-[color:var(--foreground)]' : 'text-[color:var(--text-secondary)]'}>
                          {option.label}
                        </span>
                        {scope.color === option.value && (
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-auto text-[color:var(--accent-primary)]">
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Delete */}
            {!scope.is_default && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--accent-danger)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6" />
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
                <span>Delete</span>
              </button>
            )}
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          {/* Business Goals */}
          <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
            <EditableGoalsSection
              goals={scope.goals ?? []}
              onSave={handleGoalsSave}
            />
          </div>

          {/* Custom fields */}
          {customFields.length > 0 && (
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <CustomFieldsRenderer
                fields={customFields}
                values={(scope.custom_fields as Record<string, unknown>) ?? {}}
                onChange={handleCustomFieldChange}
              />
            </div>
          )}

          {/* Related entities */}
          <RelatedEntitiesSection
            projectId={projectId}
            entityType="product_scope"
            entityId={scope.id}
            allowedTypes={['session', 'company', 'contact', 'issue', 'knowledge_source']}
          />
        </div>
      </aside>

      {/* Delete confirmation */}
      <Dialog
        open={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title={`Delete ${scope.type === 'initiative' ? 'Initiative' : 'Product Area'}`}
        size="md"
      >
        <p className="text-sm text-[color:var(--text-secondary)]">
          Are you sure you want to delete &quot;{scope.name}&quot;? Items associated with it will become unclassified.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => setShowDeleteConfirm(false)}>Cancel</Button>
          <Button variant="danger" size="sm" onClick={handleDelete}>Delete</Button>
        </div>
      </Dialog>
    </>
  )
}

// ============================================================================
// Editable Text Field (click-to-edit, per-field)
// ============================================================================

function EditableTextField({
  value,
  fieldKey,
  onSave,
  placeholder,
  type = 'text',
  maxLength,
}: {
  value: string | null | undefined
  fieldKey: string
  onSave: (fieldKey: string, newValue: string) => Promise<boolean>
  placeholder?: string
  type?: 'text' | 'textarea'
  maxLength?: number
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value ?? '')
  const [isSaving, setIsSaving] = useState(false)

  const handleStartEdit = () => {
    setEditValue(value ?? '')
    setIsEditing(true)
  }

  const handleCancel = () => {
    setEditValue(value ?? '')
    setIsEditing(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    const success = await onSave(fieldKey, editValue)
    setIsSaving(false)
    if (success) setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && type !== 'textarea') void handleSave()
    if (e.key === 'Escape') handleCancel()
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-start gap-1">
          {type === 'textarea' ? (
            <textarea
              value={editValue}
              onChange={(e) => setEditValue(maxLength ? e.target.value.substring(0, maxLength) : e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              rows={2}
              maxLength={maxLength}
              placeholder={placeholder}
              className="flex-1 rounded-[4px] border border-[color:var(--border-subtle)] bg-transparent px-2 py-1 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent-selected)]"
            />
          ) : (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(maxLength ? e.target.value.substring(0, maxLength) : e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              maxLength={maxLength}
              placeholder={placeholder}
              className="flex-1 rounded-[4px] border border-[color:var(--border-subtle)] bg-transparent px-2 py-1 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent-selected)]"
            />
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={isSaving}
            className="rounded-[4px] p-1 text-[color:var(--accent-success)] transition hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
            aria-label="Save"
          >
            {isSaving ? (
              <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            )}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="rounded-[4px] p-1 text-[color:var(--accent-danger)] transition hover:bg-[color:var(--surface-hover)]"
            aria-label="Cancel"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="group flex items-start gap-1">
      <p className={`flex-1 text-sm ${value ? 'text-[color:var(--foreground)]' : 'text-[color:var(--text-tertiary)]'}`}>
        {value || placeholder || '-'}
      </p>
      <button
        type="button"
        onClick={handleStartEdit}
        className="rounded-[4px] p-1 text-[color:var(--text-secondary)] opacity-0 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)] group-hover:opacity-100"
        aria-label="Edit"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
      </button>
    </div>
  )
}

// ============================================================================
// Editable Name (badge with hover edit icon, like session sidebar name)
// ============================================================================

function EditableName({
  name,
  color,
  isDefault,
  onSave,
}: {
  name: string
  color: TagColorVariant
  isDefault: boolean
  onSave: (newName: string) => Promise<boolean>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(name)
  const [isSaving, setIsSaving] = useState(false)

  const handleStartEdit = () => {
    if (isDefault) return
    setEditValue(name)
    setIsEditing(true)
  }

  const handleCancel = () => {
    setEditValue(name)
    setIsEditing(false)
  }

  const handleSave = async () => {
    const trimmed = editValue.trim()
    if (!trimmed) return
    setIsSaving(true)
    const success = await onSave(trimmed)
    setIsSaving(false)
    if (success) setIsEditing(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') void handleSave()
    if (e.key === 'Escape') handleCancel()
  }

  if (isEditing) {
    return (
      <div className="mt-1 flex items-center gap-1">
        <input
          type="text"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value.substring(0, MAX_NAME_LENGTH))}
          onKeyDown={handleKeyDown}
          onBlur={() => void handleSave()}
          autoFocus
          maxLength={MAX_NAME_LENGTH}
          disabled={isSaving}
          className="w-48 rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-2 py-1 text-lg font-semibold text-[color:var(--foreground)] focus:border-[color:var(--accent-primary)] focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-primary)] disabled:opacity-50"
          placeholder="Scope name..."
        />
      </div>
    )
  }

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={handleStartEdit}
        disabled={isDefault}
        className="group flex items-center gap-2 text-left disabled:cursor-default"
      >
        <Badge variant={color}>{name}</Badge>
        {isDefault && (
          <span className="text-xs text-[color:var(--text-tertiary)]">(default)</span>
        )}
        {!isDefault && (
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-[color:var(--text-tertiary)] opacity-0 transition group-hover:opacity-100">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
        )}
      </button>
    </div>
  )
}

// ============================================================================
// Editable Goals Section
// ============================================================================

function EditableGoalsSection({
  goals: initialGoals,
  onSave,
}: {
  goals: ProductScopeGoal[]
  onSave: (goals: ProductScopeGoal[]) => Promise<boolean>
}) {
  const [isEditing, setIsEditing] = useState(false)
  const [goals, setGoals] = useState<ProductScopeGoal[]>(initialGoals)
  const [isSaving, setIsSaving] = useState(false)

  // Sync when prop changes (after external save)
  useEffect(() => {
    if (!isEditing) setGoals(initialGoals)
  }, [initialGoals, isEditing])

  const handleStartEdit = () => {
    setGoals(initialGoals)
    setIsEditing(true)
  }

  const handleCancel = () => {
    setGoals(initialGoals)
    setIsEditing(false)
  }

  const handleSave = async () => {
    setIsSaving(true)
    const success = await onSave(goals)
    setIsSaving(false)
    if (success) setIsEditing(false)
  }

  const handleAddGoal = () => {
    setGoals((prev) => [...prev, { id: `goal_${Date.now()}`, text: '' }])
  }

  const handleGoalChange = (goalId: string, text: string) => {
    setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, text: text.substring(0, MAX_GOAL_LENGTH) } : g)))
  }

  const handleRemoveGoal = (goalId: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== goalId))
  }

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">Business Goals</label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="rounded-[4px] p-1 text-[color:var(--accent-success)] transition hover:bg-[color:var(--surface-hover)] disabled:opacity-50"
              aria-label="Save goals"
            >
              {isSaving ? (
                <svg className="animate-spin" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="12" /></svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
              )}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-[4px] p-1 text-[color:var(--accent-danger)] transition hover:bg-[color:var(--surface-hover)]"
              aria-label="Cancel"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          {goals.map((goal) => (
            <div key={goal.id} className="flex items-center gap-2">
              <input
                value={goal.text}
                onChange={(e) => handleGoalChange(goal.id, e.target.value)}
                placeholder="Goal description"
                maxLength={MAX_GOAL_LENGTH}
                className="flex-1 rounded-[4px] border border-[color:var(--border-subtle)] bg-transparent px-2 py-1 text-sm text-[color:var(--foreground)] outline-none focus:border-[color:var(--accent-selected)]"
              />
              <button
                type="button"
                onClick={() => handleRemoveGoal(goal.id)}
                className="rounded-[4px] p-1 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--accent-danger)]"
                aria-label="Remove goal"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={handleAddGoal}
            className="text-xs text-[color:var(--accent-primary)] hover:underline self-start"
          >
            + Add goal
          </button>
        </div>
      </div>
    )
  }

  // Read-only view
  return (
    <div className="group flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">Business Goals</label>
        <button
          type="button"
          onClick={handleStartEdit}
          className="rounded-[4px] p-1 text-[color:var(--text-secondary)] opacity-0 transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)] group-hover:opacity-100"
          aria-label="Edit goals"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
        </button>
      </div>
      {initialGoals.length > 0 ? (
        <ul className="flex flex-col gap-1 pl-4 text-sm text-[color:var(--foreground)]">
          {initialGoals.map((goal) => (
            <li key={goal.id} className="list-disc">{goal.text}</li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[color:var(--text-tertiary)]">No goals defined</p>
      )}
    </div>
  )
}

// ============================================================================
// Create Mode Sidebar
// ============================================================================

function CreateModeSidebar({
  projectId,
  onClose,
  onCreate,
  existingSlugs,
}: ProductScopeSidebarCreateProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [color, setColor] = useState<TagColorVariant>('info')
  const [scopeType, setScopeType] = useState<ProductScopeType>('product_area')
  const [goals, setGoals] = useState<ProductScopeGoal[]>([])
  const [formError, setFormError] = useState<string | null>(null)
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, unknown>>({})

  const { fields: customFields } = useCustomFields({
    projectId,
    entityType: 'product_scope',
  })

  const handleCustomFieldChange = useCallback((key: string, value: unknown) => {
    setCustomFieldValues((prev) => ({ ...prev, [key]: value }))
  }, [])

  const headerLabel = scopeType === 'initiative' ? 'New Initiative' : 'New Product Area'

  const handleSave = useCallback(() => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      setFormError('Name is required.')
      return
    }
    const slug = generateSlugFromName(trimmedName)
    if (!slug || !/^[a-z][a-z0-9_]*$/.test(slug)) {
      setFormError('Name must start with a letter.')
      return
    }
    if (existingSlugs.includes(slug)) {
      setFormError('A product scope with this name already exists.')
      return
    }
    const filteredGoals = goals.filter((g) => g.text.trim())
    const cfPayload = Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined
    onCreate({
      name: trimmedName,
      slug,
      description: description.trim(),
      color,
      type: scopeType,
      goals: filteredGoals.length > 0 ? filteredGoals : null,
      custom_fields: cfPayload,
    })
  }, [name, description, color, scopeType, goals, customFieldValues, existingSlugs, onCreate])

  const handleAddGoal = useCallback(() => {
    setGoals((prev) => [...prev, { id: `goal_${Date.now()}`, text: '' }])
  }, [])

  const handleGoalChange = useCallback((goalId: string, text: string) => {
    setGoals((prev) => prev.map((g) => (g.id === goalId ? { ...g, text: text.substring(0, MAX_GOAL_LENGTH) } : g)))
  }, [])

  const handleRemoveGoal = useCallback((goalId: string) => {
    setGoals((prev) => prev.filter((g) => g.id !== goalId))
  }, [])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/20" onClick={onClose} aria-hidden="true" />
      <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-2xl flex-col border-l-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] shadow-xl">
        {/* Header */}
        <div className="shrink-0 border-b-2 border-[color:var(--border-subtle)] p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ScopeTypeIcon type={scopeType} />
              <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
                {headerLabel}
              </span>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-[4px] p-2 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--foreground)]"
              aria-label="Close sidebar"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          {name && (
            <div className="mt-1">
              <Badge variant={color}>{name}</Badge>
            </div>
          )}
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto">
          <div className="border-b-2 border-[color:var(--border-subtle)] p-4 flex flex-col gap-4">
            {formError && (
              <div className="rounded-md bg-[color:var(--background-danger)] p-2 text-xs text-[color:var(--text-danger)]">
                {formError}
              </div>
            )}
            <FormField label="Name">
              <Input
                value={name}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value.substring(0, MAX_NAME_LENGTH))}
                placeholder="e.g., Billing, Onboarding, API"
                maxLength={MAX_NAME_LENGTH}
                autoFocus
              />
            </FormField>
            <FormField label="Type">
              <Select
                value={scopeType}
                onChange={(e: ChangeEvent<HTMLSelectElement>) => setScopeType(e.target.value as ProductScopeType)}
              >
                {TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </Select>
            </FormField>
            <FormField
              label="Description"
              supportingText={`${description.length}/${MAX_DESCRIPTION_LENGTH}`}
            >
              <Textarea
                value={description}
                onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setDescription(e.target.value.substring(0, MAX_DESCRIPTION_LENGTH))}
                placeholder="What this product scope covers"
                rows={3}
                maxLength={MAX_DESCRIPTION_LENGTH}
              />
            </FormField>
            <FormField as="div" label="Color">
              <div className="flex items-center gap-4">
                <div className="flex gap-2">
                  {COLOR_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setColor(option.value)}
                      className={`h-6 w-6 rounded-full ${option.colorClass} transition-all ${
                        color === option.value
                          ? 'ring-2 ring-[color:var(--accent-primary)] ring-offset-2 ring-offset-[color:var(--background)]'
                          : 'hover:scale-110'
                      }`}
                      title={option.label}
                    />
                  ))}
                </div>
              </div>
            </FormField>
            {/* Goals */}
            <FormField as="div" label="Business Goals">
              <div className="flex flex-col gap-2">
                {goals.map((goal) => (
                  <div key={goal.id} className="flex items-center gap-2">
                    <Input
                      value={goal.text}
                      onChange={(e: ChangeEvent<HTMLInputElement>) => handleGoalChange(goal.id, e.target.value)}
                      placeholder="Goal description"
                      maxLength={MAX_GOAL_LENGTH}
                      className="flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemoveGoal(goal.id)}
                      className="rounded-[4px] p-1 text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)] hover:text-[color:var(--accent-danger)]"
                      aria-label="Remove goal"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={handleAddGoal}
                  className="text-xs text-[color:var(--accent-primary)] hover:underline self-start"
                >
                  + Add goal
                </button>
              </div>
            </FormField>
            {/* Custom fields */}
            {customFields.length > 0 && (
              <CustomFieldsRenderer
                fields={customFields}
                values={customFieldValues}
                onChange={handleCustomFieldChange}
              />
            )}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={onClose}>Cancel</Button>
              <Button size="sm" onClick={handleSave}>Create</Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}
