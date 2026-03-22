'use client'

import { useState, useCallback, useEffect } from 'react'
import { Dialog, Button, Spinner, Alert } from '@/components/ui'
import { fetchNotionPages, fetchNotionChildPages } from '@/lib/api/integrations'
import { addNotionSources } from '@/lib/api/knowledge'

interface NotionPageItem {
  id: string
  title: string
  icon: string | null
  url: string
  lastEditedTime: string
  type: 'page' | 'database'
}

interface NotionPickerDialogProps {
  open: boolean
  onClose: () => void
  projectId: string
  onImported?: () => void
  /** When 'single', only one page can be selected and onPageSelected is called */
  mode?: 'bulk' | 'single'
  onPageSelected?: (page: { pageId: string; title: string; url: string }) => void
}

export function NotionPickerDialog({
  open,
  onClose,
  projectId,
  onImported,
  mode = 'bulk',
  onPageSelected,
}: NotionPickerDialogProps) {
  const [pages, setPages] = useState<NotionPageItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)

  // Expanded databases: databaseId -> child pages
  const [expandedDatabases, setExpandedDatabases] = useState<Record<string, NotionPageItem[]>>({})
  const [loadingDatabases, setLoadingDatabases] = useState<Set<string>>(new Set())

  const loadPages = useCallback(async (searchQuery?: string, cursor?: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const params: Record<string, string> = {}
      if (searchQuery) params.query = searchQuery
      if (cursor) params.startCursor = cursor

      const response = await fetchNotionPages(projectId, params)
      if (!response.ok) {
        throw new Error('Failed to load Notion pages')
      }
      const data = await response.json()

      if (cursor) {
        setPages(prev => [...prev, ...data.pages])
      } else {
        setPages(data.pages || [])
      }
      setNextCursor(data.nextCursor)
      setHasMore(data.hasMore)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pages')
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (open) {
      setSelectedIds(new Set())
      setExpandedDatabases({})
      setSuccess(null)
      void loadPages()
    }
  }, [open, loadPages])

  const handleSearch = useCallback(() => {
    setNextCursor(null)
    void loadPages(query || undefined)
  }, [query, loadPages])

  const handleLoadMore = useCallback(() => {
    if (nextCursor) {
      void loadPages(query || undefined, nextCursor)
    }
  }, [nextCursor, query, loadPages])

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      if (mode === 'single') {
        return prev.has(id) ? new Set() : new Set([id])
      }
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleExpandDatabase = async (databaseId: string) => {
    if (expandedDatabases[databaseId]) {
      // Collapse
      setExpandedDatabases(prev => {
        const next = { ...prev }
        delete next[databaseId]
        return next
      })
      return
    }

    setLoadingDatabases(prev => new Set([...prev, databaseId]))
    try {
      const response = await fetchNotionChildPages(projectId, databaseId)
      if (!response.ok) throw new Error('Failed to load child pages')
      const data = await response.json()
      setExpandedDatabases(prev => ({ ...prev, [databaseId]: data.pages || [] }))
    } catch {
      setError('Failed to load database pages')
    } finally {
      setLoadingDatabases(prev => {
        const next = new Set(prev)
        next.delete(databaseId)
        return next
      })
    }
  }

  const handleImport = async () => {
    if (selectedIds.size === 0) return

    setIsImporting(true)
    setError(null)
    setSuccess(null)

    try {
      // Collect all selected pages (from top-level and expanded databases)
      const allPages = [...pages]
      for (const children of Object.values(expandedDatabases)) {
        allPages.push(...children)
      }

      const selectedPages = allPages
        .filter(p => selectedIds.has(p.id))
        .map(p => ({
          pageId: p.id,
          title: p.title,
          url: p.url,
        }))

      await addNotionSources(projectId, selectedPages)
      setSuccess(`Imported ${selectedPages.length} page${selectedPages.length === 1 ? '' : 's'} successfully.`)
      setSelectedIds(new Set())
      onImported?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import pages')
    } finally {
      setIsImporting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString()
    } catch {
      return ''
    }
  }

  return (
    <Dialog open={open} onClose={onClose} title={mode === 'single' ? 'Select Notion Page' : 'Import from Notion'} size="xxl">
      <div className="flex flex-col gap-4">
        {error && <Alert variant="danger">{error}</Alert>}
        {success && <Alert variant="success">{success}</Alert>}

        {/* Search */}
        <div className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="Search Notion pages..."
            className="flex-1 rounded-[4px] border border-[color:var(--border)] bg-[color:var(--background)] px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-[color:var(--accent-selected)]"
          />
          <Button variant="secondary" size="sm" onClick={handleSearch} disabled={isLoading}>
            Search
          </Button>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto border border-[color:var(--border-subtle)] rounded-[4px]">
          {isLoading && pages.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : pages.length === 0 ? (
            <p className="text-sm text-[color:var(--text-tertiary)] py-8 text-center">
              No pages found. Try a different search term.
            </p>
          ) : (
            <div className="divide-y divide-[color:var(--border-subtle)]">
              {pages.map((page) => (
                <div key={page.id}>
                  <div
                    className="flex items-center gap-3 px-3 py-2 hover:bg-[color:var(--surface-hover)] cursor-pointer"
                    onClick={() => page.type === 'database' ? handleExpandDatabase(page.id) : toggleSelection(page.id)}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(page.id)}
                      onChange={() => toggleSelection(page.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="shrink-0"
                    />
                    <span className="shrink-0 text-base">
                      {page.icon || (page.type === 'database' ? '\uD83D\uDDC3\uFE0F' : '\uD83D\uDCC4')}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-[color:var(--foreground)] truncate">
                          {page.title || 'Untitled'}
                        </span>
                        {page.type === 'database' && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-[color:var(--surface)] text-[color:var(--text-tertiary)]">
                            Database
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-[color:var(--text-tertiary)]">
                        {formatDate(page.lastEditedTime)}
                      </span>
                    </div>
                    {page.type === 'database' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); handleExpandDatabase(page.id) }}
                        disabled={loadingDatabases.has(page.id)}
                      >
                        {loadingDatabases.has(page.id) ? <Spinner size="sm" /> : expandedDatabases[page.id] ? 'Collapse' : 'Expand'}
                      </Button>
                    )}
                  </div>

                  {/* Expanded database children */}
                  {expandedDatabases[page.id] && (
                    <div className="pl-8 border-l-2 border-[color:var(--border-subtle)] ml-6">
                      {expandedDatabases[page.id].map((child) => (
                        <div
                          key={child.id}
                          className="flex items-center gap-3 px-3 py-2 hover:bg-[color:var(--surface-hover)] cursor-pointer"
                          onClick={() => toggleSelection(child.id)}
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(child.id)}
                            onChange={() => toggleSelection(child.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="shrink-0"
                          />
                          <span className="shrink-0 text-base">
                            {child.icon || '\uD83D\uDCC4'}
                          </span>
                          <span className="text-sm text-[color:var(--foreground)] truncate flex-1">
                            {child.title || 'Untitled'}
                          </span>
                          <span className="text-xs text-[color:var(--text-tertiary)]">
                            {formatDate(child.lastEditedTime)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Load More */}
        {hasMore && (
          <Button variant="ghost" size="sm" onClick={handleLoadMore} loading={isLoading}>
            Load more
          </Button>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-[color:var(--border-subtle)] pt-4">
          <span className="text-sm text-[color:var(--text-secondary)]">
            {selectedIds.size > 0
              ? `${selectedIds.size} page${selectedIds.size === 1 ? '' : 's'} selected`
              : mode === 'single' ? 'Select a page' : 'Select pages to import'}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            {mode === 'single' ? (
              <Button
                variant="primary"
                disabled={selectedIds.size === 0}
                onClick={() => {
                  const selectedId = [...selectedIds][0]
                  const allPages = [...pages]
                  for (const children of Object.values(expandedDatabases)) {
                    allPages.push(...children)
                  }
                  const page = allPages.find(p => p.id === selectedId)
                  if (page && onPageSelected) {
                    onPageSelected({ pageId: page.id, title: page.title, url: page.url })
                  }
                }}
              >
                Select
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleImport}
                disabled={selectedIds.size === 0 || isImporting}
                loading={isImporting}
              >
                Import
              </Button>
            )}
          </div>
        </div>
      </div>
    </Dialog>
  )
}
