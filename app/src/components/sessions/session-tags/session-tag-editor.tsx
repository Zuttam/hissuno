'use client'

import { useState, useCallback, useMemo } from 'react'
import { SessionTagList } from './session-tag-badge'
import { SESSION_TAGS, SESSION_TAG_INFO, type CustomTagRecord } from '@/types/session'
import { updateSessionTags } from '@/lib/api/sessions'

function PlusIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  )
}

function LoaderIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

interface TagOption {
  slug: string
  label: string
  variant: 'info' | 'success' | 'danger' | 'warning' | 'default'
  isCustom: boolean
}

interface SessionTagEditorProps {
  projectId: string
  sessionId: string
  /** Array of current tag slugs (native or custom) */
  currentTags: string[]
  /** Callback when tags are updated */
  onTagsUpdated: (tags: string[]) => void
  /** Custom tags for the project (optional) */
  customTags?: CustomTagRecord[]
  disabled?: boolean
}

/**
 * Editor component for managing session tags.
 * Shows current tags with remove buttons and a dropdown to add new tags.
 * Supports both native tags and custom tags.
 */
export function SessionTagEditor({
  projectId,
  sessionId,
  currentTags,
  onTagsUpdated,
  customTags = [],
  disabled = false,
}: SessionTagEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Build list of all available tag options
  const allTagOptions = useMemo((): TagOption[] => {
    const nativeTags: TagOption[] = SESSION_TAGS.map((tag) => ({
      slug: tag,
      label: SESSION_TAG_INFO[tag].label,
      variant: SESSION_TAG_INFO[tag].variant,
      isCustom: false,
    }))

    const customTagOptions: TagOption[] = customTags.map((tag) => ({
      slug: tag.slug,
      label: tag.name,
      variant: (tag.color as TagOption['variant']) || 'default',
      isCustom: true,
    }))

    return [...nativeTags, ...customTagOptions]
  }, [customTags])

  // Get available tags (not already applied)
  const availableTags = useMemo(
    () => allTagOptions.filter((tag) => !currentTags.includes(tag.slug)),
    [allTagOptions, currentTags]
  )

  const nativeAvailable = availableTags.filter((t) => !t.isCustom)
  const customAvailable = availableTags.filter((t) => t.isCustom)

  const getVariantColor = (variant: TagOption['variant']) => {
    switch (variant) {
      case 'success':
        return 'bg-[color:var(--accent-success)]'
      case 'danger':
        return 'bg-[color:var(--accent-danger)]'
      case 'warning':
        return 'bg-[color:var(--accent-warning)]'
      case 'default':
        return 'bg-[color:var(--text-tertiary)]'
      default:
        return 'bg-[color:var(--accent-primary)]'
    }
  }

  const handleAddTag = useCallback(
    async (slug: string) => {
      if (disabled || isSaving) return

      const newTags = [...currentTags, slug]
      setIsSaving(true)
      setIsOpen(false)

      try {
        await updateSessionTags(projectId, sessionId, newTags)
        onTagsUpdated(newTags)
      } catch (error) {
        console.error('[SessionTagEditor] Error adding tag:', error)
      } finally {
        setIsSaving(false)
      }
    },
    [projectId, sessionId, currentTags, onTagsUpdated, disabled, isSaving]
  )

  const handleRemoveTag = useCallback(
    async (slug: string) => {
      if (disabled || isSaving) return

      const newTags = currentTags.filter((t) => t !== slug)
      setIsSaving(true)

      try {
        await updateSessionTags(projectId, sessionId, newTags)
        onTagsUpdated(newTags)
      } catch (error) {
        console.error('[SessionTagEditor] Error removing tag:', error)
      } finally {
        setIsSaving(false)
      }
    },
    [projectId, sessionId, currentTags, onTagsUpdated, disabled, isSaving]
  )

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
          Tags
        </label>
        {isSaving && (
          <LoaderIcon className="h-3 w-3 animate-spin text-[color:var(--text-tertiary)]" />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <SessionTagList
          tags={currentTags}
          customTags={customTags}
          removable={!disabled}
          onRemove={handleRemoveTag}
          size="md"
          emptyText=""
        />

        {/* Add tag button/dropdown */}
        {!disabled && availableTags.length > 0 && (
          <div className="relative">
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              disabled={isSaving}
              className="inline-flex items-center gap-0.5 rounded-[4px] border-2 border-dashed border-[color:var(--border-subtle)] px-1.5 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider text-[color:var(--text-tertiary)] transition hover:border-[color:var(--border)] hover:text-[color:var(--text-secondary)] disabled:opacity-50"
            >
              <PlusIcon className="h-3 w-3" />
              Add
            </button>

            {isOpen && (
              <>
                {/* Backdrop to close dropdown */}
                <div
                  className="fixed inset-0 z-10"
                  onClick={() => setIsOpen(false)}
                />
                {/* Dropdown */}
                <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] max-h-[250px] overflow-y-auto rounded-[4px] border-2 border-[color:var(--border)] bg-[color:var(--surface)] py-1 shadow-lg">
                  {/* Native tags */}
                  {nativeAvailable.map((tag) => (
                    <button
                      key={tag.slug}
                      type="button"
                      onClick={() => handleAddTag(tag.slug)}
                      className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-[color:var(--surface-hover)]"
                    >
                      <span className={`h-2 w-2 rounded-full ${getVariantColor(tag.variant)}`} />
                      {tag.label}
                    </button>
                  ))}

                  {/* Custom tags */}
                  {customAvailable.length > 0 && (
                    <>
                      {nativeAvailable.length > 0 && (
                        <div className="border-t border-[color:var(--border-subtle)] my-1" />
                      )}
                      <div className="px-3 py-1 text-[10px] font-medium text-[color:var(--text-tertiary)] uppercase">
                        Custom Tags
                      </div>
                      {customAvailable.map((tag) => (
                        <button
                          key={tag.slug}
                          type="button"
                          onClick={() => handleAddTag(tag.slug)}
                          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-[color:var(--surface-hover)]"
                        >
                          <span className={`h-2 w-2 rounded-full ${getVariantColor(tag.variant)}`} />
                          {tag.label}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {currentTags.length === 0 && availableTags.length === allTagOptions.length && (
          <span className="text-xs text-[color:var(--text-tertiary)]">No tags</span>
        )}
      </div>
    </div>
  )
}
