'use client'

import { forwardRef, useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/utils/class'

export interface ComboboxItem {
  value: string
  label: string
}

export interface ComboboxProps {
  items: ComboboxItem[]
  onSearch?: (query: string) => Promise<ComboboxItem[]> | ComboboxItem[]
  value: string | undefined
  onValueChange: (value: string | undefined) => void
  placeholder?: string
  emptyMessage?: string
  size?: 'sm' | 'md'
  disabled?: boolean
  className?: string
  inputClassName?: string
}

const sizeConfig = {
  sm: {
    input: 'h-6 rounded-full border px-2 py-0 text-[10px]',
    dropdown: 'max-h-48 w-56 text-[10px]',
    item: 'px-2 py-1.5',
    clearSize: 10,
  },
  md: {
    input: 'rounded-[4px] border-2 px-3 py-2 text-sm font-mono',
    dropdown: 'max-h-64 text-sm',
    item: 'px-3 py-2',
    clearSize: 14,
  },
} as const

const Combobox = forwardRef<HTMLInputElement, ComboboxProps>(
  (
    {
      items,
      onSearch,
      value,
      onValueChange,
      placeholder = 'Search...',
      emptyMessage = 'No results found',
      size = 'md',
      disabled = false,
      className,
      inputClassName,
    },
    ref
  ) => {
    const id = useId()
    const listboxId = `${id}-listbox`

    const [isOpen, setIsOpen] = useState(false)
    const [query, setQuery] = useState('')
    const [highlightedIndex, setHighlightedIndex] = useState(-1)
    const [searchResults, setSearchResults] = useState<ComboboxItem[] | null>(null)

    const containerRef = useRef<HTMLDivElement>(null)
    const internalInputRef = useRef<HTMLInputElement | null>(null)
    const listRef = useRef<HTMLUListElement>(null)
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const config = sizeConfig[size]

    const selectedLabel = useMemo(() => {
      if (!value) return null
      return items.find((item) => item.value === value)?.label ?? null
    }, [value, items])

    // Local filtering when no onSearch provided
    const localFiltered = useMemo(() => {
      if (!query) return items
      const lower = query.toLowerCase()
      return items.filter((item) => item.label.toLowerCase().includes(lower))
    }, [items, query])

    const displayedItems = onSearch ? (searchResults ?? items) : localFiltered

    // Debounced onSearch
    useEffect(() => {
      if (!onSearch || !isOpen) return

      if (debounceRef.current) clearTimeout(debounceRef.current)

      if (!query) {
        setSearchResults(null)
        return
      }

      debounceRef.current = setTimeout(async () => {
        const results = await onSearch(query)
        setSearchResults(results)
      }, 200)

      return () => {
        if (debounceRef.current) clearTimeout(debounceRef.current)
      }
    }, [query, onSearch, isOpen])

    // Close on outside click
    useEffect(() => {
      if (!isOpen) return
      function handleMouseDown(e: MouseEvent) {
        if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
          setIsOpen(false)
          setQuery('')
          setHighlightedIndex(-1)
        }
      }
      document.addEventListener('mousedown', handleMouseDown)
      return () => document.removeEventListener('mousedown', handleMouseDown)
    }, [isOpen])

    // Reset highlight when items change
    useEffect(() => {
      setHighlightedIndex(-1)
    }, [displayedItems])

    // Scroll highlighted item into view
    useEffect(() => {
      if (highlightedIndex < 0 || !listRef.current) return
      const item = listRef.current.children[highlightedIndex] as HTMLElement | undefined
      item?.scrollIntoView({ block: 'nearest' })
    }, [highlightedIndex])

    const close = useCallback(() => {
      setIsOpen(false)
      setQuery('')
      setHighlightedIndex(-1)
      setSearchResults(null)
    }, [])

    const handleSelect = useCallback(
      (itemValue: string) => {
        onValueChange(itemValue)
        close()
      },
      [onValueChange, close]
    )

    const handleClear = useCallback(() => {
      onValueChange(undefined)
      setQuery('')
    }, [onValueChange])

    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        setQuery(e.target.value)
        if (!isOpen) setIsOpen(true)
        setHighlightedIndex(-1)
      },
      [isOpen]
    )

    const handleFocus = useCallback(() => {
      if (!disabled) setIsOpen(true)
    }, [disabled])

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (!isOpen) {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault()
            setIsOpen(true)
          }
          return
        }

        switch (e.key) {
          case 'ArrowDown':
            e.preventDefault()
            setHighlightedIndex((prev) =>
              prev < displayedItems.length - 1 ? prev + 1 : 0
            )
            break
          case 'ArrowUp':
            e.preventDefault()
            setHighlightedIndex((prev) =>
              prev > 0 ? prev - 1 : displayedItems.length - 1
            )
            break
          case 'Enter':
            e.preventDefault()
            if (highlightedIndex >= 0 && highlightedIndex < displayedItems.length) {
              handleSelect(displayedItems[highlightedIndex].value)
            }
            break
          case 'Escape':
            e.preventDefault()
            close()
            break
        }
      },
      [isOpen, displayedItems, highlightedIndex, handleSelect, close]
    )

    const activeDescendant =
      highlightedIndex >= 0 ? `${id}-option-${highlightedIndex}` : undefined

    return (
      <div ref={containerRef} className={cn('relative', className)}>
        <div className="relative">
          <input
            ref={(node) => {
              internalInputRef.current = node
              if (typeof ref === 'function') ref(node)
              else if (ref) ref.current = node
            }}
            type="text"
            role="combobox"
            aria-expanded={isOpen}
            aria-controls={listboxId}
            aria-activedescendant={activeDescendant}
            aria-autocomplete="list"
            placeholder={isOpen ? placeholder : (selectedLabel ?? placeholder)}
            value={isOpen ? query : (selectedLabel ?? '')}
            onChange={handleInputChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            className={cn(
              'w-full border-[color:var(--border-subtle)] bg-transparent text-[color:var(--foreground)] outline-none transition focus:border-[color:var(--accent-primary)]',
              config.input,
              value && !isOpen && 'text-[color:var(--foreground)]',
              disabled && 'cursor-not-allowed opacity-50',
              inputClassName
            )}
          />
          {value && !isOpen && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Clear selection"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[color:var(--text-secondary)] hover:text-[color:var(--foreground)]"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width={config.clearSize}
                height={config.clearSize}
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
            </button>
          )}
        </div>
        {isOpen && (
          <ul
            ref={listRef}
            id={listboxId}
            role="listbox"
            className={cn(
              'absolute left-0 top-full z-50 mt-1 w-full overflow-y-auto rounded-[4px] border border-[color:var(--border-subtle)] bg-[color:var(--background)] py-1 shadow-lg',
              config.dropdown
            )}
          >
            {displayedItems.length === 0 ? (
              <li className={cn('text-[color:var(--text-secondary)]', config.item)}>
                {emptyMessage}
              </li>
            ) : (
              displayedItems.map((item, index) => (
                <li
                  key={item.value}
                  id={`${id}-option-${index}`}
                  role="option"
                  aria-selected={item.value === value}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    handleSelect(item.value)
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                  className={cn(
                    'w-full cursor-pointer truncate text-left transition',
                    config.item,
                    item.value === value
                      ? 'font-medium text-[color:var(--foreground)]'
                      : 'text-[color:var(--text-secondary)]',
                    index === highlightedIndex && 'bg-[color:var(--surface-hover)]'
                  )}
                >
                  {item.label}
                </li>
              ))
            )}
          </ul>
        )}
      </div>
    )
  }
)
Combobox.displayName = 'Combobox'

export { Combobox }
