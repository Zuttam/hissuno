'use client'

import { useCallback } from 'react'
import { Input, Select } from '@/components/ui'
import type { IssueFilters, IssueType, IssuePriority, IssueStatus } from '@/types/issue'
import type { ProjectWithCodebase } from '@/lib/projects/queries'

interface IssuesFiltersProps {
  projects: ProjectWithCodebase[]
  filters: IssueFilters
  onFilterChange: (filters: IssueFilters) => void
}

export function IssuesFilters({
  projects,
  filters,
  onFilterChange,
}: IssuesFiltersProps) {
  const handleProjectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFilterChange({ ...filters, projectId: e.target.value || undefined })
    },
    [filters, onFilterChange]
  )

  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFilterChange({ ...filters, type: (e.target.value as IssueType) || undefined })
    },
    [filters, onFilterChange]
  )

  const handlePriorityChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFilterChange({ ...filters, priority: (e.target.value as IssuePriority) || undefined })
    },
    [filters, onFilterChange]
  )

  const handleStatusChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFilterChange({ ...filters, status: (e.target.value as IssueStatus) || undefined })
    },
    [filters, onFilterChange]
  )

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange({ ...filters, search: e.target.value || undefined })
    },
    [filters, onFilterChange]
  )

  const handleClearFilters = useCallback(() => {
    onFilterChange({})
  }, [onFilterChange])

  const hasActiveFilters =
    filters.projectId ||
    filters.type ||
    filters.priority ||
    filters.status ||
    filters.search

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
            Type
          </label>
          <Select
            value={filters.type || ''}
            onChange={handleTypeChange}
            className="w-40"
          >
            <option value="">All types</option>
            <option value="bug">Bug</option>
            <option value="feature_request">Feature Request</option>
            <option value="change_request">Change Request</option>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Priority
          </label>
          <Select
            value={filters.priority || ''}
            onChange={handlePriorityChange}
            className="w-32"
          >
            <option value="">All</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
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
            <option value="open">Open</option>
            <option value="in_progress">In Progress</option>
            <option value="resolved">Resolved</option>
            <option value="closed">Closed</option>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="font-mono text-xs uppercase tracking-wide text-[color:var(--text-secondary)]">
            Search
          </label>
          <Input
            type="text"
            placeholder="Search issues..."
            value={filters.search || ''}
            onChange={handleSearchChange}
            className="w-48"
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
