'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createPortal } from 'react-dom'
import Fuse from 'fuse.js'
import { cn } from '@/lib/utils/class'
import type { SearchIndexEntry } from '@/app/(marketing)/docs/_lib/search-index'

interface DocsSearchDialogProps {
  searchIndex: SearchIndexEntry[]
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function getSnippet(content: string, query: string, length = 120): string {
  const lower = content.toLowerCase()
  const idx = lower.indexOf(query.toLowerCase())
  if (idx === -1) return content.slice(0, length) + (content.length > length ? '...' : '')
  const start = Math.max(0, idx - 40)
  const end = Math.min(content.length, idx + length - 40)
  const prefix = start > 0 ? '...' : ''
  const suffix = end < content.length ? '...' : ''
  return prefix + content.slice(start, end) + suffix
}

export function DocsSearchDialog({ searchIndex }: DocsSearchDialogProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [mounted, setMounted] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)
  const fuseRef = useRef<Fuse<SearchIndexEntry> | null>(null)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
  }, [])

  // Initialize Fuse lazily
  const getFuse = useCallback(() => {
    if (!fuseRef.current) {
      fuseRef.current = new Fuse(searchIndex, {
        keys: [
          { name: 'title', weight: 2.0 },
          { name: 'description', weight: 1.5 },
          { name: 'content', weight: 1.0 },
        ],
        threshold: 0.4,
        includeMatches: true,
        minMatchCharLength: 2,
      })
    }
    return fuseRef.current
  }, [searchIndex])

  // Global keyboard shortcut + custom event from sidebar trigger
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
    }
    function handleOpenEvent() {
      setOpen(true)
    }
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('docs-search-open', handleOpenEvent)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('docs-search-open', handleOpenEvent)
    }
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      setTimeout(() => inputRef.current?.focus(), 0)
    } else {
      document.body.style.overflow = ''
      setQuery('')
      setActiveIndex(0)
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  const results = query.length >= 2 ? getFuse().search(query, { limit: 20 }) : []

  // Group results by category
  const grouped = results.reduce<Record<string, typeof results>>((acc, result) => {
    const cat = result.item.categoryTitle
    if (!acc[cat]) acc[cat] = []
    acc[cat].push(result)
    return acc
  }, {})
  const flatResults = results

  // Scroll active result into view
  useEffect(() => {
    if (!resultsRef.current) return
    const active = resultsRef.current.querySelector('[data-active="true"]')
    if (active) {
      active.scrollIntoView({ block: 'nearest' })
    }
  }, [activeIndex])

  function handleKeyDown(e: React.KeyboardEvent) {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setActiveIndex((prev) => Math.min(prev + 1, flatResults.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex((prev) => Math.max(prev - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (flatResults[activeIndex]) {
          router.push(flatResults[activeIndex].item.href)
          setOpen(false)
        }
        break
      case 'Escape':
        e.preventDefault()
        setOpen(false)
        break
    }
  }

  if (!mounted) return null
  if (!open) return null

  let resultIndex = -1

  return createPortal(
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[60] bg-black/20 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div className="fixed inset-0 z-[70] flex items-start justify-center px-4 pt-[15vh]">
        <div
          className="w-full max-w-xl flex flex-col rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] shadow-xl max-h-[60vh]"
          role="dialog"
          aria-modal="true"
          aria-label="Search documentation"
        >
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-[color:var(--border-subtle)] px-4 py-3">
            <SearchIcon className="shrink-0 text-[color:var(--text-secondary)]" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search docs..."
              className="flex-1 bg-transparent text-sm text-[color:var(--foreground)] placeholder-[color:var(--text-secondary)] outline-none"
              autoComplete="off"
              spellCheck={false}
            />
            <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-[4px] border border-[color:var(--border-subtle)] px-1.5 py-0.5 font-mono text-[10px] text-[color:var(--text-secondary)]">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={resultsRef} className="flex-1 overflow-y-auto p-2">
            {query.length >= 2 && flatResults.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-[color:var(--text-secondary)]">
                No results found for &quot;{query}&quot;
              </div>
            )}

            {query.length < 2 && query.length > 0 && (
              <div className="px-3 py-8 text-center text-sm text-[color:var(--text-secondary)]">
                Type at least 2 characters to search
              </div>
            )}

            {query.length === 0 && (
              <div className="px-3 py-8 text-center text-sm text-[color:var(--text-secondary)]">
                Start typing to search the documentation
              </div>
            )}

            {Object.entries(grouped).map(([category, categoryResults]) => (
              <div key={category} className="mb-2">
                <div className="px-3 py-1.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-[color:var(--text-secondary)]">
                  {category}
                </div>
                {categoryResults.map((result) => {
                  resultIndex++
                  const isActive = resultIndex === activeIndex
                  const currentIndex = resultIndex

                  return (
                    <button
                      key={result.item.href}
                      type="button"
                      data-active={isActive}
                      onClick={() => {
                        router.push(result.item.href)
                        setOpen(false)
                      }}
                      onMouseEnter={() => setActiveIndex(currentIndex)}
                      className={cn(
                        'w-full rounded-[4px] px-3 py-2 text-left transition',
                        isActive
                          ? 'bg-[color:var(--surface-hover)] text-[color:var(--foreground)]'
                          : 'text-[color:var(--text-secondary)] hover:bg-[color:var(--surface-hover)]'
                      )}
                    >
                      <div
                        className={cn(
                          'text-sm font-medium',
                          isActive && 'text-[color:var(--accent-teal)]'
                        )}
                      >
                        {result.item.title}
                      </div>
                      {result.item.description && (
                        <div className="mt-0.5 text-xs text-[color:var(--text-secondary)] line-clamp-1">
                          {getSnippet(result.item.content || result.item.description, query, 100)}
                        </div>
                      )}
                    </button>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}

/** Trigger button for the sidebar and mobile nav */
export function DocsSearchTrigger({ className }: { className?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('docs-search-open'))}
      className={cn(
        'flex w-full items-center gap-2 rounded-[4px] border border-[color:var(--border-subtle)] px-3 py-2 text-sm text-[color:var(--text-secondary)] transition hover:border-[color:var(--accent-teal)] hover:text-[color:var(--foreground)]',
        className
      )}
    >
      <SearchIcon className="shrink-0" />
      <span className="flex-1 text-left">Search docs...</span>
      <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-[4px] border border-[color:var(--border-subtle)] px-1.5 py-0.5 font-mono text-[10px]">
        <span>&#8984;K</span>
      </kbd>
    </button>
  )
}
