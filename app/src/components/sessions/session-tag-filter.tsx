'use client'

import { useState, useCallback, useMemo } from 'react'
import { SESSION_TAGS, SESSION_TAG_INFO, type CustomTagRecord } from '@/types/session'

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

interface TagOption {
  slug: string
  label: string
  variant: 'info' | 'success' | 'danger' | 'warning' | 'default'
  isCustom: boolean
}

interface SessionTagFilterProps {
  /** Currently selected tag slugs */
  selectedTags: string[]
  /** Callback when selection changes */
  onChange: (tags: string[]) => void
  /** Custom tags for the project (optional) */
  customTags?: CustomTagRecord[]
}

/**
 * Multi-select filter component for filtering sessions by tags.
 * Supports both native tags and custom tags.
 */
export function SessionTagFilter({
  selectedTags,
  onChange,
  customTags = [],
}: SessionTagFilterProps) {
  const [isOpen, setIsOpen] = useState(false)

  // Build combined list of all tags (native + custom)
  const allTags = useMemo((): TagOption[] => {
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

  const handleToggleTag = useCallback(
    (slug: string) => {
      if (selectedTags.includes(slug)) {
        onChange(selectedTags.filter((t) => t !== slug))
      } else {
        onChange([...selectedTags, slug])
      }
    },
    [selectedTags, onChange]
  )

  const handleClear = useCallback(() => {
    onChange([])
  }, [onChange])

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
          <div className="absolute left-0 top-full z-20 mt-1 w-full min-w-[200px] max-h-[300px] overflow-y-auto rounded-[4px] border-2 border-[color:var(--border)] bg-[color:var(--surface)] py-1 shadow-lg">
            {/* Native tags section */}
            {allTags.filter(t => !t.isCustom).map((tag) => {
              const isSelected = selectedTags.includes(tag.slug)
              return (
                <button
                  key={tag.slug}
                  type="button"
                  onClick={() => handleToggleTag(tag.slug)}
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
                  <span className={`h-2 w-2 rounded-full ${getVariantColor(tag.variant)}`} />
                  {tag.label}
                </button>
              )
            })}

            {/* Custom tags section */}
            {customTags.length > 0 && (
              <>
                <div className="border-t border-[color:var(--border-subtle)] my-1" />
                <div className="px-3 py-1 text-[10px] font-medium text-[color:var(--text-tertiary)] uppercase">
                  Custom Tags
                </div>
                {allTags.filter(t => t.isCustom).map((tag) => {
                  const isSelected = selectedTags.includes(tag.slug)
                  return (
                    <button
                      key={tag.slug}
                      type="button"
                      onClick={() => handleToggleTag(tag.slug)}
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
                      <span className={`h-2 w-2 rounded-full ${getVariantColor(tag.variant)}`} />
                      {tag.label}
                    </button>
                  )
                })}
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}
