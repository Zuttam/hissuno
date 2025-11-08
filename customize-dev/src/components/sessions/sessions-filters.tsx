'use client'

import { useCallback } from 'react'
import { Input, Select } from '@/components/ui'
import type { SessionFilters } from '@/types/session'
import type { ProjectWithCodebase } from '@/lib/projects/queries'

interface SessionsFiltersProps {
  projects: ProjectWithCodebase[]
  filters: SessionFilters
  onFilterChange: (filters: SessionFilters) => void
}

export function SessionsFilters({
  projects,
  filters,
  onFilterChange,
}: SessionsFiltersProps) {
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

  const handleClearFilters = useCallback(() => {
    onFilterChange({})
  }, [onFilterChange])

  const hasActiveFilters =
    filters.projectId ||
    filters.userId ||
    filters.sessionId ||
    filters.status ||
    filters.dateFrom ||
    filters.dateTo

  return (
    <div className="rounded-[4px] border-2 border-[color:var(--border-subtle)] bg-[color:var(--background)] p-4">
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
    </div>
  )
}
