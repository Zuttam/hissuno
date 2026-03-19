'use client'

import { useState, useCallback, type ChangeEvent } from 'react'
import { Button, Input, Textarea, Badge, IconButton, FormField, Select } from '@/components/ui'
import type { TagColorVariant } from '@/types/session'
import type { ProductScopeType, ProductScopeGoal } from '@/types/product-scope'
import { generateSlugFromName } from '@/lib/security/sanitize'

const MAX_SCOPES = 20
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

/**
 * Local product scope type for client-side management.
 * Scopes with temp_ prefix IDs are new and haven't been saved yet.
 */
export interface LocalProductScope {
  id: string
  name: string
  slug: string
  description: string
  color: TagColorVariant
  position: number
  is_default: boolean
  type: ProductScopeType
  goals: ProductScopeGoal[] | null
}

interface ProductScopesSectionProps {
  scopes: LocalProductScope[]
  onScopesChange: (scopes: LocalProductScope[]) => void
  onCommit?: (scopes: LocalProductScope[]) => void
  canAddMore: boolean
  isLoading?: boolean
  error?: string | null
}

interface ScopeFormState {
  name: string
  description: string
  color: TagColorVariant
  type: ProductScopeType
  goals: ProductScopeGoal[]
}

const EMPTY_FORM: ScopeFormState = {
  name: '',
  description: '',
  color: 'info',
  type: 'product_area',
  goals: [],
}

export function ProductScopesSection({
  scopes,
  onScopesChange,
  onCommit,
  canAddMore,
  isLoading,
  error,
}: ProductScopesSectionProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formState, setFormState] = useState<ScopeFormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const toggleExpanded = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const handleStartAdd = useCallback(() => {
    setIsAdding(true)
    setEditingId(null)
    setFormState(EMPTY_FORM)
    setFormError(null)
  }, [])

  const handleStartEdit = useCallback((scope: LocalProductScope) => {
    setIsAdding(false)
    setEditingId(scope.id)
    setFormState({
      name: scope.name,
      description: scope.description,
      color: scope.color,
      type: scope.type,
      goals: scope.goals ?? [],
    })
    setFormError(null)
  }, [])

  const handleCancel = useCallback(() => {
    setIsAdding(false)
    setEditingId(null)
    setFormState(EMPTY_FORM)
    setFormError(null)
  }, [])

  const handleNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value.substring(0, MAX_NAME_LENGTH)
    setFormState((prev) => ({ ...prev, name }))
  }, [])

  const handleDescriptionChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const description = e.target.value.substring(0, MAX_DESCRIPTION_LENGTH)
    setFormState((prev) => ({ ...prev, description }))
  }, [])

  const handleColorChange = useCallback((color: TagColorVariant) => {
    setFormState((prev) => ({ ...prev, color }))
  }, [])

  const handleTypeChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setFormState((prev) => ({ ...prev, type: e.target.value as ProductScopeType }))
  }, [])

  const handleAddGoal = useCallback(() => {
    setFormState((prev) => ({
      ...prev,
      goals: [...prev.goals, { id: `goal_${Date.now()}`, text: '' }],
    }))
  }, [])

  const handleGoalChange = useCallback((goalId: string, text: string) => {
    setFormState((prev) => ({
      ...prev,
      goals: prev.goals.map((g) => (g.id === goalId ? { ...g, text: text.substring(0, MAX_GOAL_LENGTH) } : g)),
    }))
  }, [])

  const handleRemoveGoal = useCallback((goalId: string) => {
    setFormState((prev) => ({
      ...prev,
      goals: prev.goals.filter((g) => g.id !== goalId),
    }))
  }, [])

  const generatedSlug = generateSlugFromName(formState.name)

  // Editing default scope only allows description + color changes
  const editingScope = editingId ? scopes.find((a) => a.id === editingId) : null
  const isEditingDefault = editingScope?.is_default ?? false

  const validateForm = useCallback((): string | null => {
    if (!isEditingDefault) {
      if (!formState.name.trim()) {
        return 'Name is required.'
      }
      if (formState.name.length > MAX_NAME_LENGTH) {
        return `Name must be ${MAX_NAME_LENGTH} characters or less.`
      }
      if (!generatedSlug.trim()) {
        return 'Name must contain at least one letter.'
      }
      if (!/^[a-z][a-z0-9_]*$/.test(generatedSlug)) {
        return 'Name must start with a letter.'
      }
      // Check for duplicate slugs
      const existingScope = scopes.find((a) => a.slug === generatedSlug && a.id !== editingId)
      if (existingScope) {
        return 'A product scope with this name already exists.'
      }
    }
    if (formState.description.length > MAX_DESCRIPTION_LENGTH) {
      return `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.`
    }
    return null
  }, [formState, scopes, editingId, generatedSlug, isEditingDefault])

  const handleSave = useCallback(() => {
    const validationError = validateForm()
    if (validationError) {
      setFormError(validationError)
      return
    }

    const cleanedGoals = formState.goals.filter((g) => g.text.trim())

    if (isAdding) {
      const newScope: LocalProductScope = {
        id: `temp_${Date.now()}`,
        name: formState.name.trim(),
        slug: generatedSlug,
        description: formState.description.trim(),
        color: formState.color,
        position: scopes.length,
        is_default: false,
        type: formState.type,
        goals: cleanedGoals.length > 0 ? cleanedGoals : null,
      }
      const updatedScopes = [...scopes, newScope]
      onScopesChange(updatedScopes)
      onCommit?.(updatedScopes)
      handleCancel()
    } else if (editingId) {
      const updatedScopes = scopes.map((scope) => {
        if (scope.id !== editingId) return scope
        // For default scope, only update description, color, and goals
        if (scope.is_default) {
          return {
            ...scope,
            description: formState.description.trim(),
            color: formState.color,
            goals: cleanedGoals.length > 0 ? cleanedGoals : null,
          }
        }
        return {
          ...scope,
          name: formState.name.trim(),
          slug: generatedSlug,
          description: formState.description.trim(),
          color: formState.color,
          type: formState.type,
          goals: cleanedGoals.length > 0 ? cleanedGoals : null,
        }
      })
      onScopesChange(updatedScopes)
      onCommit?.(updatedScopes)
      handleCancel()
    }
  }, [validateForm, isAdding, editingId, formState, generatedSlug, scopes, onScopesChange, onCommit, handleCancel])

  const handleDelete = useCallback(
    (scopeId: string) => {
      const scope = scopes.find((a) => a.id === scopeId)
      if (scope?.is_default) return // Cannot delete default scope

      if (
        !confirm(
          'Are you sure you want to delete this product scope? Items associated with it will become unclassified.'
        )
      ) {
        return
      }
      const filteredScopes = scopes.filter((a) => a.id !== scopeId)
      const repositionedScopes = filteredScopes.map((a, index) => ({
        ...a,
        position: index,
      }))
      onScopesChange(repositionedScopes)
      onCommit?.(repositionedScopes)
    },
    [scopes, onScopesChange, onCommit]
  )

  const isEditing = isAdding || editingId !== null

  return (
    <div className="space-y-4">
      <p className="text-sm text-[color:var(--text-secondary)]">
        Define product scopes to organize your knowledge, feedback, and issues into high-level themes.
        The &quot;Default&quot; scope captures anything not assigned to a specific scope.
      </p>

      {error && (
        <div className="rounded-md bg-[color:var(--background-danger)] p-3 text-sm text-[color:var(--text-danger)]">
          {error}
        </div>
      )}

      {/* Scopes list */}
      <div className="space-y-1">
        {scopes.map((scope) => (
          <div
            key={scope.id}
            className="rounded-lg bg-[color:var(--background-secondary)] p-2"
          >
            {editingId === scope.id ? (
              <div className="flex-1 space-y-4 py-1">
                <ScopeForm
                  formState={formState}
                  onNameChange={handleNameChange}
                  onDescriptionChange={handleDescriptionChange}
                  onColorChange={handleColorChange}
                  onTypeChange={handleTypeChange}
                  onAddGoal={handleAddGoal}
                  onGoalChange={handleGoalChange}
                  onRemoveGoal={handleRemoveGoal}
                  formError={formError}
                  isDefault={scope.is_default}
                />
                <div className="flex justify-end gap-2">
                  <Button size="sm" variant="ghost" onClick={handleCancel}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave}>
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <div className="flex items-center gap-3">
                  <Badge variant={scope.color}>{scope.name}</Badge>
                  {scope.type === 'initiative' && (
                    <Badge variant="default">Initiative</Badge>
                  )}
                  {scope.is_default && (
                    <span className="text-xs text-[color:var(--text-tertiary)]">
                      (default)
                    </span>
                  )}
                  <div className="ml-auto flex shrink-0 gap-1">
                    <IconButton
                      size="sm"
                      aria-label="Edit scope"
                      onClick={() => handleStartEdit(scope)}
                      disabled={isEditing}
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                    </IconButton>
                    {!scope.is_default && (
                      <IconButton
                        size="sm"
                        aria-label="Delete scope"
                        onClick={() => handleDelete(scope.id)}
                        disabled={isEditing}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </IconButton>
                    )}
                  </div>
                </div>
                {scope.description && (
                  <p className={`text-sm text-[color:var(--text-secondary)] ${!expandedIds.has(scope.id) ? 'line-clamp-3' : ''}`}>
                    {scope.description}
                    {scope.description.length > 120 && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(scope.id)}
                        className="ml-1 inline text-xs text-[color:var(--accent-primary)] hover:underline"
                      >
                        {expandedIds.has(scope.id) ? 'less' : 'more'}
                      </button>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {scopes.length === 0 && !isAdding && (
        <p className="py-4 text-center text-sm text-[color:var(--text-secondary)]">
          No product scopes defined yet.
        </p>
      )}

      {/* Add new scope form */}
      {isAdding && (
        <div className="space-y-4">
          <ScopeForm
            formState={formState}
            onNameChange={handleNameChange}
            onDescriptionChange={handleDescriptionChange}
            onColorChange={handleColorChange}
            onTypeChange={handleTypeChange}
            onAddGoal={handleAddGoal}
            onGoalChange={handleGoalChange}
            onRemoveGoal={handleRemoveGoal}
            formError={formError}
            isDefault={false}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Add Scope
            </Button>
          </div>
        </div>
      )}

      {/* Add button */}
      {!isEditing && (
        <div className="flex items-center justify-between">
          <Button
            size="sm"
            variant="secondary"
            onClick={handleStartAdd}
            disabled={!canAddMore || isLoading}
          >
            + Add Product Area or Initiative
          </Button>
          <span className="text-xs text-[color:var(--text-tertiary)]">
            {scopes.length} / {MAX_SCOPES} scopes
          </span>
        </div>
      )}

      {!canAddMore && !isEditing && (
        <p className="text-xs text-[color:var(--text-tertiary)]">
          Maximum of {MAX_SCOPES} product scopes reached.
        </p>
      )}
    </div>
  )
}

/* Scope form fields */
interface ScopeFormProps {
  formState: ScopeFormState
  onNameChange: (e: ChangeEvent<HTMLInputElement>) => void
  onDescriptionChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  onColorChange: (color: TagColorVariant) => void
  onTypeChange: (e: ChangeEvent<HTMLSelectElement>) => void
  onAddGoal: () => void
  onGoalChange: (goalId: string, text: string) => void
  onRemoveGoal: (goalId: string) => void
  formError: string | null
  isDefault: boolean
}

function ScopeForm({
  formState,
  onNameChange,
  onDescriptionChange,
  onColorChange,
  onTypeChange,
  onAddGoal,
  onGoalChange,
  onRemoveGoal,
  formError,
  isDefault,
}: ScopeFormProps) {
  return (
    <div className="space-y-4">
      {formError && (
        <div className="rounded-md bg-[color:var(--background-danger)] p-2 text-xs text-[color:var(--text-danger)]">
          {formError}
        </div>
      )}

      {!isDefault && (
        <FormField label="Scope Name" description="A short name for this product scope">
          <Input
            value={formState.name}
            onChange={onNameChange}
            placeholder="e.g., Billing, Onboarding, API"
            maxLength={MAX_NAME_LENGTH}
          />
        </FormField>
      )}

      {!isDefault && (
        <FormField label="Type" description="Product area or initiative">
          <Select value={formState.type} onChange={onTypeChange}>
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </Select>
        </FormField>
      )}

      <FormField
        label="Description"
        description="What this product scope covers"
        supportingText={`${formState.description.length}/${MAX_DESCRIPTION_LENGTH}`}
      >
        <Textarea
          value={formState.description}
          onChange={onDescriptionChange}
          placeholder="Describe the scope of this product scope"
          rows={2}
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
                onClick={() => onColorChange(option.value)}
                className={`h-6 w-6 rounded-full ${option.colorClass} transition-all ${
                  formState.color === option.value
                    ? 'ring-2 ring-[color:var(--accent-primary)] ring-offset-2 ring-offset-[color:var(--background)]'
                    : 'hover:scale-110'
                }`}
                title={option.label}
                aria-label={`Select ${option.label} color`}
                aria-pressed={formState.color === option.value}
              />
            ))}
          </div>

          {formState.name && !isDefault && (
            <Badge variant={formState.color}>{formState.name}</Badge>
          )}
        </div>
      </FormField>

      {/* Goals */}
      <FormField as="div" label="Goals">
        <div className="flex flex-col gap-2">
          {formState.goals.map((goal) => (
            <div key={goal.id} className="flex items-center gap-2">
              <Input
                value={goal.text}
                onChange={(e: ChangeEvent<HTMLInputElement>) => onGoalChange(goal.id, e.target.value)}
                placeholder="Goal description"
                maxLength={MAX_GOAL_LENGTH}
                className="flex-1"
              />
              <button
                type="button"
                onClick={() => onRemoveGoal(goal.id)}
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
            onClick={onAddGoal}
            className="text-xs text-[color:var(--accent-primary)] hover:underline self-start"
          >
            + Add goal
          </button>
        </div>
      </FormField>
    </div>
  )
}
