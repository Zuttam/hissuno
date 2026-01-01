'use client'

import { useState, useCallback } from 'react'
import { SESSION_TAGS, SESSION_TAG_INFO, type SessionTag } from '@/types/session'

function ChevronDownIcon({ className }: { className?: string }) {
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
      <polyline points="6 9 12 15 18 9" />
    </svg>
  )
}

function XIcon({ className }: { className?: string }) {
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
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

interface SessionTagFilterProps {
  selectedTags: SessionTag[]
  onChange: (tags: SessionTag[]) => void
}

/**
 * Multi-select filter component for filtering sessions by tags.
 */
export function SessionTagFilter({ selectedTags, onChange }: SessionTagFilterProps) {
  const [isOpen, setIsOpen] = useState(false)

  const handleToggleTag = useCallback(
    (tag: SessionTag) => {
      if (selectedTags.includes(tag)) {
        onChange(selectedTags.filter((t) => t !== tag))
      } else {
        onChange([...selectedTags, tag])
      }
    },
    [selectedTags, onChange]
  )

  const handleClear = useCallback(() => {
    onChange([])
  }, [onChange])

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex h-9 w-48 items-center justify-between rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--surface)] px-3 text-sm transition hover:border-[color:var(--border)] focus:border-[color:var(--accent-primary)] focus:outline-none"
      >
        <span className="truncate text-[color:var(--text-secondary)]">
          {selectedTags.length === 0
            ? 'All tags'
            : `${selectedTags.length} tag${selectedTags.length > 1 ? 's' : ''}`}
        </span>
        <div className="flex items-center gap-1">
          {selectedTags.length > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleClear()
              }}
              className="rounded p-0.5 hover:bg-[color:var(--surface-hover)]"
              aria-label="Clear tag filter"
            >
              <XIcon className="h-3 w-3 text-[color:var(--text-tertiary)]" />
            </button>
          )}
          <ChevronDownIcon className="h-4 w-4 text-[color:var(--text-tertiary)]" />
        </div>
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-10"
            onClick={() => setIsOpen(false)}
          />
          {/* Dropdown */}
          <div className="absolute left-0 top-full z-20 mt-1 w-full min-w-[200px] rounded-[4px] border-2 border-[color:var(--border)] bg-[color:var(--surface)] py-1 shadow-lg">
            {SESSION_TAGS.map((tag) => {
              const info = SESSION_TAG_INFO[tag]
              const isSelected = selectedTags.includes(tag)
              return (
                <button
                  key={tag}
                  type="button"
                  onClick={() => handleToggleTag(tag)}
                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-[color:var(--surface-hover)] ${
                    isSelected ? 'bg-[color:var(--surface-hover)]' : ''
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => {}}
                    className="h-3 w-3 rounded border-[color:var(--border)] accent-[color:var(--accent-primary)]"
                  />
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
  )
}
