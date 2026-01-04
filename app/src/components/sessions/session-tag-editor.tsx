'use client'

import { useState, useCallback } from 'react'
import { SessionTagList } from './session-tag-badge'
import { SESSION_TAGS, SESSION_TAG_INFO, type SessionTag } from '@/types/session'

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

interface SessionTagEditorProps {
  sessionId: string
  currentTags: SessionTag[]
  onTagsUpdated: (tags: SessionTag[]) => void
  disabled?: boolean
}

/**
 * Editor component for managing session tags.
 * Shows current tags with remove buttons and a dropdown to add new tags.
 */
export function SessionTagEditor({
  sessionId,
  currentTags,
  onTagsUpdated,
  disabled = false,
}: SessionTagEditorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Get available tags (not already applied)
  const availableTags = SESSION_TAGS.filter((tag) => !currentTags.includes(tag))

  const handleAddTag = useCallback(
    async (tag: SessionTag) => {
      if (disabled || isSaving) return

      const newTags = [...currentTags, tag]
      setIsSaving(true)
      setIsOpen(false)

      try {
        const response = await fetch(`/api/sessions/${sessionId}/tags`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: newTags }),
        })

        if (response.ok) {
          onTagsUpdated(newTags)
        } else {
          console.error('[SessionTagEditor] Failed to add tag')
        }
      } catch (error) {
        console.error('[SessionTagEditor] Error adding tag:', error)
      } finally {
        setIsSaving(false)
      }
    },
    [sessionId, currentTags, onTagsUpdated, disabled, isSaving]
  )

  const handleRemoveTag = useCallback(
    async (tag: SessionTag) => {
      if (disabled || isSaving) return

      const newTags = currentTags.filter((t) => t !== tag)
      setIsSaving(true)

      try {
        const response = await fetch(`/api/sessions/${sessionId}/tags`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tags: newTags }),
        })

        if (response.ok) {
          onTagsUpdated(newTags)
        } else {
          console.error('[SessionTagEditor] Failed to remove tag')
        }
      } catch (error) {
        console.error('[SessionTagEditor] Error removing tag:', error)
      } finally {
        setIsSaving(false)
      }
    },
    [sessionId, currentTags, onTagsUpdated, disabled, isSaving]
  )

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="font-mono text-xs font-bold uppercase tracking-wider text-[color:var(--text-secondary)]">
          Tags
        </label>
        {isSaving && (
          <LoaderIcon className="h-3 w-3 animate-spin text-[color:var(--text-tertiary)]" />
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1">
        <SessionTagList
          tags={currentTags}
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
                <div className="absolute left-0 top-full z-20 mt-1 min-w-[160px] rounded-[4px] border-2 border-[color:var(--border)] bg-[color:var(--surface)] py-1 shadow-lg">
                  {availableTags.map((tag) => {
                    const info = SESSION_TAG_INFO[tag]
                    return (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => handleAddTag(tag)}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-[color:var(--surface-hover)]"
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            info.variant === 'success'
                              ? 'bg-[color:var(--accent-success)]'
                              : info.variant === 'danger'
                                ? 'bg-[color:var(--accent-danger)]'
                                : info.variant === 'warning'
                                  ? 'bg-[color:var(--accent-warning)]'
                                  : 'bg-[color:var(--accent-primary)]'
                          }`}
                        />
                        {info.label}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>
        )}

        {currentTags.length === 0 && availableTags.length === SESSION_TAGS.length && (
          <span className="text-xs text-[color:var(--text-tertiary)]">No tags</span>
        )}
      </div>
    </div>
  )
}
