'use client'

import { useCallback, useMemo } from 'react'
import { Input, Select, CollapsibleSection, Button } from '@/components/ui'
import type { IssueFilters, IssueType, IssuePriority, IssueStatus } from '@/types/issue'
import type { ProjectRecord } from '@/lib/supabase/projects'

interface IssuesFiltersProps {
  projects: ProjectRecord[]
  filters: IssueFilters
  onFilterChange: (filters: IssueFilters) => void
  hideProjectFilter?: boolean
}

interface FilterChipProps {
  label: string
  active: boolean
  onClick: () => void
}

function FilterChip({ label, active, onClick }: FilterChipProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      selected={active}
      onClick={onClick}
      className="!rounded-full !px-2.5 !py-0.5 !text-[10px]"
    >
      {label}
    </Button>
  )
}

function FilterLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="mr-1 font-mono text-[10px] uppercase text-[color:var(--text-tertiary)]">
      {children}
    </span>
  )
}

const STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'ready', label: 'Ready' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

const QUICK_STATUS_OPTIONS: { value: IssueStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'ready', label: 'Ready' },
  { value: 'in_progress', label: 'In Progress' },
]

const TYPE_OPTIONS: { value: IssueType; label: string }[] = [
  { value: 'bug', label: 'Bug' },
  { value: 'feature_request', label: 'Feature' },
  { value: 'change_request', label: 'Change' },
]

const PRIORITY_OPTIONS: { value: IssuePriority; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

export function IssuesFilters({
  projects,
  filters,
  onFilterChange,
  hideProjectFilter = false,
}: IssuesFiltersProps) {
  // Status handler
  const handleStatusToggle = useCallback(
    (status: IssueStatus) => {
      onFilterChange({
        ...filters,
        status: filters.status === status ? undefined : status,
      })
    },
    [filters, onFilterChange]
  )

  // Type handler
  const handleTypeToggle = useCallback(
    (type: IssueType) => {
      onFilterChange({
        ...filters,
        type: filters.type === type ? undefined : type,
      })
    },
    [filters, onFilterChange]
  )

  // Priority handler
  const handlePriorityToggle = useCallback(
    (priority: IssuePriority) => {
      onFilterChange({
        ...filters,
        priority: filters.priority === priority ? undefined : priority,
      })
    },
    [filters, onFilterChange]
  )

  // Archived handler
  const handleArchivedToggle = useCallback(() => {
    onFilterChange({ ...filters, showArchived: !filters.showArchived || undefined })
  }, [filters, onFilterChange])

  // Project handler
  const handleProjectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFilterChange({ ...filters, projectId: e.target.value || undefined })
    },
    [filters, onFilterChange]
  )

  // Search handler
  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange({ ...filters, search: e.target.value || undefined })
    },
    [filters, onFilterChange]
  )

  const handleClearFilters = useCallback(() => {
    onFilterChange({})
  }, [onFilterChange])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.projectId) count++
    if (filters.type) count++
    if (filters.priority) count++
    if (filters.status) count++
    if (filters.search) count++
    if (filters.showArchived) count++
    return count
  }, [filters])

  const hasActiveFilters = activeFilterCount > 0

  const collapsedSummary = hasActiveFilters
    ? `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active`
    : undefined

  // Quick filters (collapsed state)
  const quickFilters = (
    <div className="flex flex-wrap items-center gap-1.5">
      <FilterLabel>Status:</FilterLabel>
      {QUICK_STATUS_OPTIONS.map((opt) => (
        <FilterChip
          key={opt.value}
          label={opt.label}
          active={filters.status === opt.value}
          onClick={() => handleStatusToggle(opt.value)}
        />
      ))}
      <span className="ml-2" />
      <FilterLabel>Type:</FilterLabel>
      {TYPE_OPTIONS.map((opt) => (
        <FilterChip
          key={opt.value}
          label={opt.label}
          active={filters.type === opt.value}
          onClick={() => handleTypeToggle(opt.value)}
        />
      ))}
    </div>
  )

  // Expanded filters (same style, more options)
  const expandedFilters = (
    <div className="flex flex-col gap-3">
      {/* Row 1: Status + Type */}
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterLabel>Status:</FilterLabel>
        {STATUS_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            label={opt.label}
            active={filters.status === opt.value}
            onClick={() => handleStatusToggle(opt.value)}
          />
        ))}
        <span className="ml-2" />
        <FilterLabel>Type:</FilterLabel>
        {TYPE_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            label={opt.label}
            active={filters.type === opt.value}
            onClick={() => handleTypeToggle(opt.value)}
          />
        ))}
      </div>

      {/* Row 2: Priority + Archived */}
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterLabel>Priority:</FilterLabel>
        {PRIORITY_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            label={opt.label}
            active={filters.priority === opt.value}
            onClick={() => handlePriorityToggle(opt.value)}
          />
        ))}
        <span className="ml-2" />
        <FilterChip
          label="Archived"
          active={filters.showArchived ?? false}
          onClick={handleArchivedToggle}
        />
      </div>

      {/* Row 3: Project + Search */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {!hideProjectFilter && (
          <div className="flex items-center gap-1">
            <FilterLabel>Project:</FilterLabel>
            <Select
              value={filters.projectId || ''}
              onChange={handleProjectChange}
              className="h-6 w-36 rounded-full border border-[color:var(--border-subtle)] bg-transparent px-2 py-0 text-[10px]"
            >
              <option value="">All</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>
        )}
        <div className="flex items-center gap-1">
          <FilterLabel>Search:</FilterLabel>
          <Input
            type="text"
            placeholder="Search issues..."
            value={filters.search || ''}
            onChange={handleSearchChange}
            className="h-6 w-40 rounded-full border border-[color:var(--border-subtle)] bg-transparent px-2 py-0 text-[10px]"
          />
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="!rounded-full !px-2.5 !py-0.5 !text-[10px]"
          >
            Clear all
          </Button>
        )}
      </div>
    </div>
  )

  return (
    <CollapsibleSection
      title="Filters"
      collapsedSummary={collapsedSummary}
      collapsedContent={quickFilters}
      defaultExpanded={false}
      variant="flat"
    >
      {expandedFilters}
    </CollapsibleSection>
  )
}
