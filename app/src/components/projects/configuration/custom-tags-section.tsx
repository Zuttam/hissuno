'use client'

import { useState, useCallback, type ChangeEvent  } from 'react'
import { Button, Input, Textarea, Badge, IconButton, FormField } from '@/components/ui'
import type { TagColorVariant } from '@/types/session'
import { generateSlugFromName } from '@/lib/security/sanitize'

const MAX_TAGS = 10
const MAX_NAME_LENGTH = 50
const MAX_DESCRIPTION_LENGTH = 500

const COLOR_OPTIONS: { value: TagColorVariant; label: string; colorClass: string }[] = [
  { value: 'info', label: 'Blue', colorClass: 'bg-blue-500' },
  { value: 'success', label: 'Green', colorClass: 'bg-green-500' },
  { value: 'warning', label: 'Yellow', colorClass: 'bg-yellow-500' },
  { value: 'danger', label: 'Red', colorClass: 'bg-red-500' },
  { value: 'default', label: 'Gray', colorClass: 'bg-gray-500' },
]

/**
 * Local tag type for client-side management.
 * Tags with temp_ prefix IDs are new and haven't been saved yet.
 */
export interface LocalCustomTag {
  id: string // Real ID for existing tags, temp_${timestamp} for new tags
  name: string
  slug: string
  description: string
  color: TagColorVariant
  position: number
}

interface CustomTagsSectionProps {
  tags: LocalCustomTag[]
  onTagsChange: (tags: LocalCustomTag[]) => void
  onCommit?: (tags: LocalCustomTag[]) => void
  canAddMore: boolean
  isLoading?: boolean
  error?: string | null
}

interface TagFormState {
  name: string
  description: string
  color: TagColorVariant
}

const EMPTY_FORM: TagFormState = {
  name: '',
  description: '',
  color: 'info',
}

export function CustomTagsSection({
  tags,
  onTagsChange,
  onCommit,
  canAddMore,
  isLoading,
  error,
}: CustomTagsSectionProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formState, setFormState] = useState<TagFormState>(EMPTY_FORM)
  const [formError, setFormError] = useState<string | null>(null)

  // Handle starting to add a new tag
  const handleStartAdd = useCallback(() => {
    setIsAdding(true)
    setEditingId(null)
    setFormState(EMPTY_FORM)
    setFormError(null)
  }, [])

  // Handle starting to edit a tag
  const handleStartEdit = useCallback((tag: LocalCustomTag) => {
    setIsAdding(false)
    setEditingId(tag.id)
    setFormState({
      name: tag.name,
      description: tag.description,
      color: tag.color,
    })
    setFormError(null)
  }, [])

  // Handle cancel
  const handleCancel = useCallback(() => {
    setIsAdding(false)
    setEditingId(null)
    setFormState(EMPTY_FORM)
    setFormError(null)
  }, [])

  // Handle name change
  const handleNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value.substring(0, MAX_NAME_LENGTH)
    setFormState((prev) => ({ ...prev, name }))
  }, [])

  // Handle description change
  const handleDescriptionChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const description = e.target.value.substring(0, MAX_DESCRIPTION_LENGTH)
    setFormState((prev) => ({ ...prev, description }))
  }, [])

  // Handle color change via swatch click
  const handleColorChange = useCallback((color: TagColorVariant) => {
    setFormState((prev) => ({ ...prev, color }))
  }, [])

  // Generate slug from name
  const generatedSlug = generateSlugFromName(formState.name)

  // Validate form
  const validateForm = useCallback((): string | null => {
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
    if (!formState.description.trim()) {
      return 'Description is required for AI classification.'
    }
    if (formState.description.length > MAX_DESCRIPTION_LENGTH) {
      return `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.`
    }
    // Check for duplicate slugs (when adding or changing name)
    const existingTag = tags.find((t) => t.slug === generatedSlug && t.id !== editingId)
    if (existingTag) {
      return 'A tag with this name already exists.'
    }
    return null
  }, [formState, tags, editingId, generatedSlug])

  // Handle save (create or update)
  const handleSave = useCallback(() => {
    const validationError = validateForm()
    if (validationError) {
      setFormError(validationError)
      return
    }

    if (isAdding) {
      // Create new tag with temporary ID
      const newTag: LocalCustomTag = {
        id: `temp_${Date.now()}`,
        name: formState.name.trim(),
        slug: generatedSlug,
        description: formState.description.trim(),
        color: formState.color,
        position: tags.length,
      }
      const updatedTags = [...tags, newTag]
      onTagsChange(updatedTags)
      onCommit?.(updatedTags)
      handleCancel()
    } else if (editingId) {
      // Update existing tag
      const updatedTags = tags.map((tag) =>
        tag.id === editingId
          ? {
              ...tag,
              name: formState.name.trim(),
              slug: generatedSlug,
              description: formState.description.trim(),
              color: formState.color,
            }
          : tag
      )
      onTagsChange(updatedTags)
      onCommit?.(updatedTags)
      handleCancel()
    }
  }, [validateForm, isAdding, editingId, formState, generatedSlug, tags, onTagsChange, onCommit, handleCancel])

  // Handle delete
  const handleDelete = useCallback(
    (tagId: string) => {
      if (
        !confirm(
          "Are you sure you want to delete this tag? Feedback with this tag will keep it, but it won't be available for new classifications."
        )
      ) {
        return
      }
      const filteredTags = tags.filter((tag) => tag.id !== tagId)
      // Reposition remaining tags
      const repositionedTags = filteredTags.map((tag, index) => ({
        ...tag,
        position: index,
      }))
      onTagsChange(repositionedTags)
      onCommit?.(repositionedTags)
    },
    [tags, onTagsChange, onCommit]
  )

  const isEditing = isAdding || editingId !== null

  return (
    <div className="space-y-4">
      {/* Error display */}
      {error && (
        <div className="p-3 rounded-md bg-[color:var(--background-danger)] text-[color:var(--text-danger)] text-sm">
          {error}
        </div>
      )}

      {/* Tags list */}
      <div className="space-y-1">
        {tags.map((tag) => (
          <div
            key={tag.id}
            className="flex items-center gap-3 p-2 rounded-lg bg-[color:var(--background-secondary)]"
          >
            {editingId === tag.id ? (
              /* Inline edit form */
              <div className="flex-1 space-y-4 py-1">
                <TagForm
                  formState={formState}
                  onNameChange={handleNameChange}
                  onDescriptionChange={handleDescriptionChange}
                  onColorChange={handleColorChange}
                  formError={formError}
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
              /* Display mode */
              <>
                <div className="flex-1 min-w-0 flex items-center gap-3">
                  <Badge variant={tag.color}>{tag.name}</Badge>
                  <p className="text-sm text-[color:var(--text-secondary)] truncate">
                    {tag.description}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <IconButton
                    size="sm"
                    aria-label="Edit tag"
                    onClick={() => handleStartEdit(tag)}
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
                    aria-label="Delete tag"
                    onClick={() => handleDelete(tag.id)}
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

      {/* Add new tag form */}
      {isAdding && (
        <div className="space-y-4">
          <TagForm
            formState={formState}
            onNameChange={handleNameChange}
            onDescriptionChange={handleDescriptionChange}
            onColorChange={handleColorChange}
            formError={formError}
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSave}>
              Add Tag
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
            + Add Custom Tag
          </Button>
          <span className="text-xs text-[color:var(--text-tertiary)]">
            {tags.length} / {MAX_TAGS} tags
          </span>
        </div>
      )}

      {!canAddMore && !isEditing && (
        <p className="text-xs text-[color:var(--text-tertiary)]">
          Maximum of {MAX_TAGS} custom tags reached.
        </p>
      )}
    </div>
  )
}

/* Tag form fields */
interface TagFormProps {
  formState: TagFormState
  onNameChange: (e: ChangeEvent<HTMLInputElement>) => void
  onDescriptionChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  onColorChange: (color: TagColorVariant) => void
  formError: string | null
}

function TagForm({
  formState,
  onNameChange,
  onDescriptionChange,
  onColorChange,
  formError,
}: TagFormProps) {
  return (
    <div className="space-y-4">
      {formError && (
        <div className="p-2 rounded-md bg-[color:var(--background-danger)] text-[color:var(--text-danger)] text-xs">
          {formError}
        </div>
      )}

      <FormField label="Tag Name" description="What users will see">
        <Input
          value={formState.name}
          onChange={onNameChange}
          placeholder="e.g., Onboarding Issue"
          maxLength={MAX_NAME_LENGTH}
        />
      </FormField>

      <FormField
        label="Description"
        description="When the AI should apply this tag"
        supportingText={`${formState.description.length}/${MAX_DESCRIPTION_LENGTH} - This helps the AI decide when to apply this tag.`}
      >
        <Textarea
          value={formState.description}
          onChange={onDescriptionChange}
          placeholder="Apply when the user has issues during their first time using the product"
          rows={2}
          maxLength={MAX_DESCRIPTION_LENGTH}
        />
      </FormField>

      <FormField as="div" label="Color">
        <div className="flex items-center gap-4">
          {/* Color swatches */}
          <div className="flex gap-2">
            {COLOR_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                onClick={() => onColorChange(option.value)}
                className={`w-6 h-6 rounded-full ${option.colorClass} transition-all ${
                  formState.color === option.value
                    ? 'ring-2 ring-offset-2 ring-[color:var(--accent-primary)] ring-offset-[color:var(--background)]'
                    : 'hover:scale-110'
                }`}
                title={option.label}
                aria-label={`Select ${option.label} color`}
                aria-pressed={formState.color === option.value}
              />
            ))}
          </div>

          {/* Live preview badge */}
          {formState.name && (
            <Badge variant={formState.color}>{formState.name}</Badge>
          )}
        </div>
      </FormField>
    </div>
  )
}

