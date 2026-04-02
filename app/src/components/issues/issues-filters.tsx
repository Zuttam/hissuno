'use client'

import { useCallback, useMemo } from 'react'
import { Search } from 'lucide-react'
import { Input, Select, CollapsibleSection, Button, FilterChip, FilterLabel } from '@/components/ui'
import type { IssueFilters, IssueType, IssuePriority, IssueStatus, MetricLevel } from '@/types/issue'
import type { ProjectRow } from '@/lib/db/queries/projects'
import { useProductScopes } from '@/hooks/use-product-scopes'

interface IssuesFiltersProps {
  projects: ProjectRow[]
  filters: IssueFilters
  onFilterChange: (filters: IssueFilters) => void
  hideProjectFilter?: boolean
  projectId?: string
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

const METRIC_LEVEL_OPTIONS: { value: MetricLevel; label: string }[] = [
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
]

export function IssuesFilters({
  projects,
  filters,
  onFilterChange,
  hideProjectFilter = false,
  projectId,
}: IssuesFiltersProps) {
  const { scopes: productScopes } = useProductScopes({ projectId: projectId ?? filters.projectId })

  // Product scope handler
  const handleProductScopeToggle = useCallback(
    (scopeId: string) => {
      const current = filters.productScopeIds ?? []
      const next = current.includes(scopeId)
        ? current.filter((id) => id !== scopeId)
        : [...current, scopeId]
      onFilterChange({ ...filters, productScopeIds: next.length > 0 ? next : undefined })
    },
    [filters, onFilterChange]
  )

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

  // Reach handler
  const handleReachToggle = useCallback(
    (level: MetricLevel) => {
      onFilterChange({
        ...filters,
        reachLevel: filters.reachLevel === level ? undefined : level,
      })
    },
    [filters, onFilterChange]
  )

  // Confidence handler
  const handleConfidenceToggle = useCallback(
    (level: MetricLevel) => {
      onFilterChange({
        ...filters,
        confidenceLevel: filters.confidenceLevel === level ? undefined : level,
      })
    },
    [filters, onFilterChange]
  )

  // Impact handler
  const handleImpactToggle = useCallback(
    (level: MetricLevel) => {
      onFilterChange({
        ...filters,
        impactLevel: filters.impactLevel === level ? undefined : level,
      })
    },
    [filters, onFilterChange]
  )

  // Effort handler
  const handleEffortToggle = useCallback(
    (level: MetricLevel) => {
      onFilterChange({
        ...filters,
        effortLevel: filters.effortLevel === level ? undefined : level,
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
    if (filters.type) count++
    if (filters.priority) count++
    if (filters.status) count++
    if (filters.search) count++
    if (filters.showArchived) count++
    if (filters.reachLevel) count++
    if (filters.impactLevel) count++
    if (filters.confidenceLevel) count++
    if (filters.effortLevel) count++
    if (filters.productScopeIds && filters.productScopeIds.length > 0) count++
    return count
  }, [filters])

  const hasActiveFilters = activeFilterCount > 0

  const collapsedSummary = hasActiveFilters
    ? `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active`
    : undefined

  // Quick filters (collapsed state)
  const quickFilters = (
    <div className="flex flex-wrap items-center gap-3">
      <div className="relative flex items-center">
        <Search size={10} className="pointer-events-none absolute left-2 text-[color:var(--text-tertiary)]" />
        <Input
          type="text"
          placeholder="Search..."
          value={filters.search || ''}
          onChange={handleSearchChange}
          className="h-6 w-48 rounded-full border border-[color:var(--border-subtle)] bg-transparent py-0 pl-6 pr-2 text-[10px]"
        />
      </div>
      <div className="flex items-center gap-1">
        <FilterLabel>Status:</FilterLabel>
        {QUICK_STATUS_OPTIONS.map((opt) => (
          <FilterChip
            key={opt.value}
            label={opt.label}
            active={filters.status === opt.value}
            onClick={() => handleStatusToggle(opt.value)}
          />
        ))}
      </div>
      <div className="flex items-center gap-1">
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
    </div>
  )

  // Expanded filters (same style, more options)
  const expandedFilters = (
    <div className="flex flex-col gap-3">
      {/* Row 1: Search + Status + Type */}
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="relative flex items-center">
          <Search size={10} className="pointer-events-none absolute left-2 text-[color:var(--text-tertiary)]" />
          <Input
            type="text"
            placeholder="Search..."
            value={filters.search || ''}
            onChange={handleSearchChange}
            className="h-6 w-48 rounded-full border border-[color:var(--border-subtle)] bg-transparent py-0 pl-6 pr-2 text-[10px]"
          />
        </div>
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

      {/* Row 3: Reach + Impact + Confidence + Effort */}
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterLabel>Reach:</FilterLabel>
        {METRIC_LEVEL_OPTIONS.map((opt) => (
          <FilterChip
            key={`reach-${opt.value}`}
            label={opt.label}
            active={filters.reachLevel === opt.value}
            onClick={() => handleReachToggle(opt.value)}
          />
        ))}
        <span className="ml-2" />
        <FilterLabel>Impact:</FilterLabel>
        {METRIC_LEVEL_OPTIONS.map((opt) => (
          <FilterChip
            key={`imp-${opt.value}`}
            label={opt.label}
            active={filters.impactLevel === opt.value}
            onClick={() => handleImpactToggle(opt.value)}
          />
        ))}
        <span className="ml-2" />
        <FilterLabel>Confidence:</FilterLabel>
        {METRIC_LEVEL_OPTIONS.map((opt) => (
          <FilterChip
            key={`conf-${opt.value}`}
            label={opt.label}
            active={filters.confidenceLevel === opt.value}
            onClick={() => handleConfidenceToggle(opt.value)}
          />
        ))}
        <span className="ml-2" />
        <FilterLabel>Effort:</FilterLabel>
        {METRIC_LEVEL_OPTIONS.map((opt) => (
          <FilterChip
            key={`eff-${opt.value}`}
            label={opt.label}
            active={filters.effortLevel === opt.value}
            onClick={() => handleEffortToggle(opt.value)}
          />
        ))}
      </div>

      {/* Row 4: Scope */}
      {productScopes.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterLabel>Scope:</FilterLabel>
          {productScopes.map((scope) => (
            <FilterChip
              key={scope.id}
              label={scope.name}
              active={filters.productScopeIds?.includes(scope.id) ?? false}
              onClick={() => handleProductScopeToggle(scope.id)}
            />
          ))}
        </div>
      )}

      {/* Row 5: Project */}
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
