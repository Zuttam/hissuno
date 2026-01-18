'use client'

import { useCallback, useState, type ChangeEvent } from 'react'
import { Button, Input, Textarea, Select, Badge, IconButton } from '@/components/ui'
import type { CustomTagRecord, CustomTagInput, TagColorVariant } from '@/types/session'
import { generateSlugFromName } from '@/lib/security/sanitize'

const MAX_TAGS = 10
const MAX_NAME_LENGTH = 50
const MAX_DESCRIPTION_LENGTH = 500

const COLOR_OPTIONS: { value: TagColorVariant; label: string }[] = [
  { value: 'info', label: 'Blue' },
  { value: 'success', label: 'Green' },
  { value: 'warning', label: 'Yellow' },
  { value: 'danger', label: 'Red' },
  { value: 'default', label: 'Gray' },
]

interface CustomTagsSectionProps {
  tags: CustomTagRecord[]
  isLoading?: boolean
  error?: string | null
  canAddMore: boolean
  onCreateTag: (input: CustomTagInput) => Promise<CustomTagRecord | null>
  onUpdateTag: (tagId: string, input: Partial<CustomTagInput>) => Promise<CustomTagRecord | null>
  onDeleteTag: (tagId: string) => Promise<boolean>
}

interface TagFormState {
  name: string
  slug: string
  description: string
  color: TagColorVariant
}

const EMPTY_FORM: TagFormState = {
  name: '',
  slug: '',
  description: '',
  color: 'info',
}

export function CustomTagsSection({
  tags,
  isLoading,
  error,
  canAddMore,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
}: CustomTagsSectionProps) {
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formState, setFormState] = useState<TagFormState>(EMPTY_FORM)
  const [isSaving, setIsSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // Handle starting to add a new tag
  const handleStartAdd = useCallback(() => {
    setIsAdding(true)
    setEditingId(null)
    setFormState(EMPTY_FORM)
    setFormError(null)
  }, [])

  // Handle starting to edit a tag
  const handleStartEdit = useCallback((tag: CustomTagRecord) => {
    setIsAdding(false)
    setEditingId(tag.id)
    setFormState({
      name: tag.name,
      slug: tag.slug,
      description: tag.description,
      color: tag.color as TagColorVariant,
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

  // Handle name change (auto-generate slug)
  const handleNameChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const name = e.target.value.substring(0, MAX_NAME_LENGTH)
    const slug = generateSlugFromName(name)
    setFormState((prev) => ({ ...prev, name, slug }))
  }, [])

  // Handle slug change (manual override)
  const handleSlugChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const slug = e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '').substring(0, 30)
    setFormState((prev) => ({ ...prev, slug }))
  }, [])

  // Handle description change
  const handleDescriptionChange = useCallback((e: ChangeEvent<HTMLTextAreaElement>) => {
    const description = e.target.value.substring(0, MAX_DESCRIPTION_LENGTH)
    setFormState((prev) => ({ ...prev, description }))
  }, [])

  // Handle color change
  const handleColorChange = useCallback((e: ChangeEvent<HTMLSelectElement>) => {
    setFormState((prev) => ({ ...prev, color: e.target.value as TagColorVariant }))
  }, [])

  // Validate form
  const validateForm = useCallback((): string | null => {
    if (!formState.name.trim()) {
      return 'Name is required.'
    }
    if (formState.name.length > MAX_NAME_LENGTH) {
      return `Name must be ${MAX_NAME_LENGTH} characters or less.`
    }
    if (!formState.slug.trim()) {
      return 'Slug is required.'
    }
    if (!/^[a-z][a-z0-9_]*$/.test(formState.slug)) {
      return 'Slug must start with a letter and contain only lowercase letters, numbers, and underscores.'
    }
    if (!formState.description.trim()) {
      return 'Description is required for AI classification.'
    }
    if (formState.description.length > MAX_DESCRIPTION_LENGTH) {
      return `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less.`
    }
    // Check for duplicate slugs (when adding or changing slug)
    const existingTag = tags.find((t) => t.slug === formState.slug && t.id !== editingId)
    if (existingTag) {
      return 'A tag with this slug already exists.'
    }
    return null
  }, [formState, tags, editingId])

  // Handle save (create or update)
  const handleSave = useCallback(async () => {
    const validationError = validateForm()
    if (validationError) {
      setFormError(validationError)
      return
    }

    setIsSaving(true)
    setFormError(null)

    try {
      if (isAdding) {
        const result = await onCreateTag({
          name: formState.name.trim(),
          slug: formState.slug.trim(),
          description: formState.description.trim(),
          color: formState.color,
        })
        if (result) {
          handleCancel()
        }
      } else if (editingId) {
        const result = await onUpdateTag(editingId, {
          name: formState.name.trim(),
          slug: formState.slug.trim(),
          description: formState.description.trim(),
          color: formState.color,
        })
        if (result) {
          handleCancel()
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save tag.'
      setFormError(message)
    } finally {
      setIsSaving(false)
    }
  }, [validateForm, isAdding, editingId, formState, onCreateTag, onUpdateTag, handleCancel])

  // Handle delete
  const handleDelete = useCallback(
    async (tagId: string) => {
      if (!confirm('Are you sure you want to delete this tag? Sessions with this tag will keep it, but it won\'t be available for new classifications.')) {
        return
      }
      await onDeleteTag(tagId)
    },
    [onDeleteTag]
  )

  const isEditing = isAdding || editingId !== null

  return (
    <div className="space-y-4">
      {/* Description */}
      <p className="text-sm text-[color:var(--text-secondary)]">
        Define custom tags for session classification. These tags will be used alongside the
        built-in tags (bug, feature request, etc.) when the AI classifies your sessions.
      </p>

      {/* Error display */}
      {error && (
        <div className="p-3 rounded-md bg-[color:var(--background-danger)] text-[color:var(--text-danger)] text-sm">
          {error}
        </div>
      )}

      {/* Tags list */}
      <div className="space-y-2">
        {tags.map((tag) => (
          <div
            key={tag.id}
            className="flex items-start gap-3 p-3 rounded-lg border border-[color:var(--border-subtle)] bg-[color:var(--background-secondary)]"
          >
            {editingId === tag.id ? (
              /* Inline edit form */
              <div className="flex-1 space-y-3">
                <TagForm
                  formState={formState}
                  onNameChange={handleNameChange}
                  onSlugChange={handleSlugChange}
                  onDescriptionChange={handleDescriptionChange}
                  onColorChange={handleColorChange}
                  formError={formError}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isSaving}>
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              /* Display mode */
              <>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={tag.color as TagColorVariant}>{tag.name}</Badge>
                    <span className="text-xs text-[color:var(--text-tertiary)] font-mono">
                      {tag.slug}
                    </span>
                  </div>
                  <p className="text-sm text-[color:var(--text-secondary)] line-clamp-2">
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
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                    </svg>
                  </IconButton>
                  <IconButton
                    size="sm"
                    aria-label="Delete tag"
                    onClick={() => void handleDelete(tag.id)}
                    disabled={isEditing}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
        <div className="p-4 rounded-lg border border-[color:var(--border-accent)] bg-[color:var(--background-secondary)]">
          <h4 className="text-sm font-medium mb-3">New Custom Tag</h4>
          <div className="space-y-3">
            <TagForm
              formState={formState}
              onNameChange={handleNameChange}
              onSlugChange={handleSlugChange}
              onDescriptionChange={handleDescriptionChange}
              onColorChange={handleColorChange}
              formError={formError}
            />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? 'Creating...' : 'Create Tag'}
              </Button>
              <Button size="sm" variant="ghost" onClick={handleCancel} disabled={isSaving}>
                Cancel
              </Button>
            </div>
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
  onSlugChange: (e: ChangeEvent<HTMLInputElement>) => void
  onDescriptionChange: (e: ChangeEvent<HTMLTextAreaElement>) => void
  onColorChange: (e: ChangeEvent<HTMLSelectElement>) => void
  formError: string | null
}

function TagForm({
  formState,
  onNameChange,
  onSlugChange,
  onDescriptionChange,
  onColorChange,
  formError,
}: TagFormProps) {
  return (
    <div className="space-y-3">
      {formError && (
        <div className="p-2 rounded-md bg-[color:var(--background-danger)] text-[color:var(--text-danger)] text-xs">
          {formError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-[color:var(--text-secondary)] mb-1">
            Display Name
          </label>
          <Input
            value={formState.name}
            onChange={onNameChange}
            placeholder="e.g., Onboarding Issue"
            maxLength={MAX_NAME_LENGTH}
          />
          <p className="text-xs text-[color:var(--text-tertiary)] mt-1">
            {formState.name.length}/{MAX_NAME_LENGTH}
          </p>
        </div>
        <div>
          <label className="block text-xs font-medium text-[color:var(--text-secondary)] mb-1">
            Slug (Internal ID)
          </label>
          <Input
            value={formState.slug}
            onChange={onSlugChange}
            placeholder="e.g., onboarding_issue"
            className="font-mono text-sm"
          />
          <p className="text-xs text-[color:var(--text-tertiary)] mt-1">
            Auto-generated from name
          </p>
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-[color:var(--text-secondary)] mb-1">
          Classification Description
        </label>
        <Textarea
          value={formState.description}
          onChange={onDescriptionChange}
          placeholder="Describe when this tag should be applied. e.g., 'Apply when the user has issues during their first time using the product'"
          rows={3}
          maxLength={MAX_DESCRIPTION_LENGTH}
        />
        <p className="text-xs text-[color:var(--text-tertiary)] mt-1">
          {formState.description.length}/{MAX_DESCRIPTION_LENGTH} - This description helps the AI
          decide when to apply this tag.
        </p>
      </div>

      <div className="w-40">
        <label className="block text-xs font-medium text-[color:var(--text-secondary)] mb-1">
          Badge Color
        </label>
        <Select value={formState.color} onChange={onColorChange}>
          {COLOR_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}
