'use client'

import { useState, useCallback, type ChangeEvent } from 'react'
import { Button, Dialog, Input, Textarea, Badge, FormField, Select } from '@/components/ui'
import { RelatedEntitiesSection } from '@/components/shared/related-entities-section'
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

interface ProductScopeSidebarProps {
  scope: ProductScopeRecord
  projectId: string
  onClose: () => void
  onSave: (updatedScope: ProductScopeRecord) => void
  onDelete: (scopeId: string) => void
}

export function ProductScopeSidebar({
  scope,
  projectId,
  onClose,
  onSave,
  onDelete,
}: ProductScopeSidebarProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(scope.name)
  const [description, setDescription] = useState(scope.description)
  const [color, setColor] = useState<TagColorVariant>(scope.color)
  const [scopeType, setScopeType] = useState<ProductScopeType>(scope.type)
  const [goals, setGoals] = useState<ProductScopeGoal[]>(scope.goals ?? [])
  const [formError, setFormError] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const headerLabel = scope.type === 'initiative' ? 'Initiative' : 'Product Area'

  const handleStartEdit = useCallback(() => {
    setName(scope.name)
    setDescription(scope.description)
    setColor(scope.color)
    setScopeType(scope.type)
    setGoals(scope.goals ?? [])
    setFormError(null)
    setIsEditing(true)
  }, [scope])

  const handleCancel = useCallback(() => {
    setIsEditing(false)
    setFormError(null)
  }, [])

  const handleSave = useCallback(() => {
    if (!scope.is_default) {
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
      onSave({
        ...scope,
        name: trimmedName,
        slug,
        description: description.trim(),
        color,
        type: scopeType,
        goals: goals.filter((g) => g.text.trim()).length > 0 ? goals.filter((g) => g.text.trim()) : null,
      })
    } else {
      onSave({
        ...scope,
        description: description.trim(),
        color,
        goals: goals.filter((g) => g.text.trim()).length > 0 ? goals.filter((g) => g.text.trim()) : null,
      })
    }
    setIsEditing(false)
    setFormError(null)
  }, [scope, name, description, color, scopeType, goals, onSave])

  const handleDelete = useCallback(() => {
    onDelete(scope.id)
    setShowDeleteConfirm(false)
    onClose()
  }, [scope.id, onDelete, onClose])

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
            <span className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
              {headerLabel}
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
          <div className="mt-1 flex items-center gap-2">
            <Badge variant={isEditing ? color : scope.color as TagColorVariant}>
              {isEditing ? (scope.is_default ? scope.name : name) : scope.name}
            </Badge>
            {scope.is_default && (
              <span className="text-xs text-[color:var(--text-tertiary)]">(default)</span>
            )}
          </div>
          {/* Action buttons */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {!isEditing && (
              <button
                type="button"
                onClick={handleStartEdit}
                className="inline-flex items-center gap-1.5 rounded-[4px] px-2 py-1 text-xs text-[color:var(--text-secondary)] transition hover:bg-[color:var(--surface-hover)]"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <span>Edit</span>
              </button>
            )}
            {!scope.is_default && !isEditing && (
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
          {/* Edit form */}
          {isEditing ? (
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4 space-y-4">
              {formError && (
                <div className="rounded-md bg-[color:var(--background-danger)] p-2 text-xs text-[color:var(--text-danger)]">
                  {formError}
                </div>
              )}
              {!scope.is_default && (
                <FormField label="Name">
                  <Input
                    value={name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) => setName(e.target.value.substring(0, MAX_NAME_LENGTH))}
                    placeholder="Scope name"
                    maxLength={MAX_NAME_LENGTH}
                  />
                </FormField>
              )}
              {!scope.is_default && (
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
              )}
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
              <FormField as="div" label="Goals">
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
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={handleCancel}>Cancel</Button>
                <Button size="sm" onClick={handleSave}>Save</Button>
              </div>
            </div>
          ) : (
            /* Read-only details */
            <div className="border-b-2 border-[color:var(--border-subtle)] p-4">
              <div className="flex flex-col gap-3 text-xs">
                {scope.description && (
                  <div className="flex flex-col gap-1">
                    <label className="font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">Description</label>
                    <p className="text-sm text-[color:var(--foreground)]">{scope.description}</p>
                  </div>
                )}
                {!scope.description && (
                  <p className="text-sm text-[color:var(--text-tertiary)]">No description</p>
                )}
                {/* Goals read view */}
                {scope.goals && scope.goals.length > 0 && (
                  <div className="flex flex-col gap-1">
                    <label className="font-mono uppercase tracking-wide text-[color:var(--text-secondary)]">Goals</label>
                    <ul className="list-disc pl-4 text-sm text-[color:var(--foreground)]">
                      {scope.goals.map((goal) => (
                        <li key={goal.id}>{goal.text}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Related entities */}
          <RelatedEntitiesSection
            projectId={projectId}
            entityType="product_scope"
            entityId={scope.id}
            allowedTypes={['session', 'company', 'issue', 'knowledge_source']}
          />
        </div>
      </aside>

      {/* Delete confirmation */}
      <Dialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title={`Delete ${headerLabel}`} size="md">
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
