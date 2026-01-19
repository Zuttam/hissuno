'use client'

import { useCallback, useMemo } from 'react'
import { Input, Select, Checkbox, CollapsibleSection } from '@/components/ui'
import type { SessionFilters, SessionSource } from '@/types/session'
import { SESSION_SOURCE_INFO } from '@/types/session'
import type { ProjectRecord } from '@/lib/supabase/projects'
import { useCustomTags } from '@/hooks/use-custom-tags'
import { SessionTagFilter } from './session-tag-filter'

interface SessionsFiltersProps {
  projects: ProjectRecord[]
  filters: SessionFilters
  onFilterChange: (filters: SessionFilters) => void
}

export function SessionsFilters({
  projects,
  filters,
  onFilterChange,
}: SessionsFiltersProps) {
  // Fetch custom tags for the selected project
  const { tags: customTags } = useCustomTags({ projectId: filters.projectId })

  const handleProjectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFilterChange({ ...filters, projectId: e.target.value || undefined })
    },
    [filters, onFilterChange]
  )

  const handleUserIdChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange({ ...filters, userId: e.target.value || undefined })
    },
    [filters, onFilterChange]
  )

  const handleSessionIdChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange({ ...filters, sessionId: e.target.value || undefined })
    },
    [filters, onFilterChange]
  )

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value as 'active' | 'closed' | ''
      onFilterChange({ ...filters, status: value || undefined })
    },
    [filters, onFilterChange]
  )

  const handleSourceChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const value = e.target.value as SessionSource | ''
      onFilterChange({ ...filters, source: value || undefined })
    },
    [filters, onFilterChange]
  )

  const handleDateFromChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange({ ...filters, dateFrom: e.target.value || undefined })
    },
    [filters, onFilterChange]
  )

  const handleDateToChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange({ ...filters, dateTo: e.target.value || undefined })
    },
    [filters, onFilterChange]
  )

  const handleTagsChange = useCallback(
    (tags: string[]) => {
      onFilterChange({ ...filters, tags: tags.length > 0 ? tags : undefined })
    },
    [filters, onFilterChange]
  )

  const handleShowArchivedChange = useCallback(
    (checked: boolean) => {
      onFilterChange({ ...filters, showArchived: checked || undefined })
    },
    [filters, onFilterChange]
  )

  const handleClearFilters = useCallback(() => {
    onFilterChange({})
  }, [onFilterChange])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.projectId) count++
    if (filters.userId) count++
    if (filters.sessionId) count++
    if (filters.status) count++
    if (filters.source) count++
    if (filters.dateFrom) count++
    if (filters.dateTo) count++
    if (filters.showArchived) count++
    if (filters.tags && filters.tags.length > 0) count++
    return count
  }, [filters])

  const hasActiveFilters = activeFilterCount > 0

  const collapsedSummary = hasActiveFilters
    ? `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active`
    : undefined

  return (
    <CollapsibleSection title="Filters" collapsedSummary={collapsedSummary} defaultExpanded={false} variant="flat">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Project
          </label>
          <Select
            value={filters.projectId || ''}
            onChange={handleProjectChange}
            className="w-48"
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            User ID
          </label>
          <Input
            type="text"
            placeholder="Search user..."
            value={filters.userId || ''}
            onChange={handleUserIdChange}
            className="w-40"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Session ID
          </label>
          <Input
            type="text"
            placeholder="Search session..."
            value={filters.sessionId || ''}
            onChange={handleSessionIdChange}
            className="w-40"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Status
          </label>
          <Select
            value={filters.status || ''}
            onChange={handleStatusChange}
            className="w-32"
          >
            <option value="">All</option>
            <option value="active">Active</option>
            <option value="closed">Closed</option>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Source
          </label>
          <Select
            value={filters.source || ''}
            onChange={handleSourceChange}
            className="w-32"
          >
            <option value="">All</option>
            {(Object.keys(SESSION_SOURCE_INFO) as SessionSource[]).map((source) => (
              <option key={source} value={source}>
                {SESSION_SOURCE_INFO[source].label}
              </option>
            ))}
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Tags
          </label>
          <SessionTagFilter
            selectedTags={filters.tags ?? []}
            onChange={handleTagsChange}
            customTags={customTags}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            From
          </label>
          <Input
            type="date"
            value={filters.dateFrom || ''}
            onChange={handleDateFromChange}
            className="w-36"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            To
          </label>
          <Input
            type="date"
            value={filters.dateTo || ''}
            onChange={handleDateToChange}
            className="w-36"
          />
        </div>

        <div className="flex items-center gap-2 self-end pb-2">
          <Checkbox
            checked={filters.showArchived || false}
            onChange={handleShowArchivedChange}
            label="Show archived"
          />
        </div>

        {hasActiveFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-transparent px-3 py-2 font-mono text-xs font-semibold uppercase tracking-wide text-[color:var(--text-secondary)] transition hover:border-[color:var(--border)] hover:bg-[color:var(--surface-hover)]"
          >
            Clear filters
          </button>
        )}
      </div>
    </CollapsibleSection>
  )
}
