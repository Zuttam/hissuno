'use client'

import { useCallback, useMemo } from 'react'
import { Input, Select, CollapsibleSection, Button } from '@/components/ui'
import type { SessionFilters, SessionSource } from '@/types/session'
import { SESSION_SOURCE_INFO, SESSION_TAGS, SESSION_TAG_INFO } from '@/types/session'
import type { ProjectRecord } from '@/lib/supabase/projects'
import { useCustomTags } from '@/hooks/use-custom-tags'

interface SessionsFiltersProps {
  projects: ProjectRecord[]
  filters: SessionFilters
  onFilterChange: (filters: SessionFilters) => void
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

export function SessionsFilters({
  projects,
  filters,
  onFilterChange,
  hideProjectFilter = false,
}: SessionsFiltersProps) {
  const { tags: customTags } = useCustomTags({ projectId: filters.projectId })

  // Status handlers
  const handleStatusToggle = useCallback(
    (status: 'active' | 'closed') => {
      onFilterChange({
        ...filters,
        status: filters.status === status ? undefined : status,
      })
    },
    [filters, onFilterChange]
  )

  // Tag handlers
  const handleTagToggle = useCallback(
    (tag: string) => {
      const currentTags = filters.tags ?? []
      const newTags = currentTags.includes(tag)
        ? currentTags.filter((t) => t !== tag)
        : [...currentTags, tag]
      onFilterChange({ ...filters, tags: newTags.length > 0 ? newTags : undefined })
    },
    [filters, onFilterChange]
  )

  // Source handlers
  const handleSourceToggle = useCallback(
    (source: SessionSource) => {
      onFilterChange({
        ...filters,
        source: filters.source === source ? undefined : source,
      })
    },
    [filters, onFilterChange]
  )

  // Archived handler
  const handleArchivedToggle = useCallback(() => {
    onFilterChange({ ...filters, showArchived: !filters.showArchived || undefined })
  }, [filters, onFilterChange])

  // Human takeover handler
  const handleHumanTakeoverToggle = useCallback(() => {
    onFilterChange({ ...filters, isHumanTakeover: !filters.isHumanTakeover || undefined })
  }, [filters, onFilterChange])

  // Project handler
  const handleProjectChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      onFilterChange({ ...filters, projectId: e.target.value || undefined })
    },
    [filters, onFilterChange]
  )

  // Date handlers
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

  // Search handlers
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

  const handleNameChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange({ ...filters, name: e.target.value || undefined })
    },
    [filters, onFilterChange]
  )

  const handleClearFilters = useCallback(() => {
    onFilterChange({})
  }, [onFilterChange])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.userId) count++
    if (filters.sessionId) count++
    if (filters.name) count++
    if (filters.status) count++
    if (filters.source) count++
    if (filters.dateFrom) count++
    if (filters.dateTo) count++
    if (filters.showArchived) count++
    if (filters.isHumanTakeover) count++
    if (filters.tags && filters.tags.length > 0) count++
    return count
  }, [filters])

  const hasActiveFilters = activeFilterCount > 0

  const collapsedSummary = hasActiveFilters
    ? `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active`
    : undefined

  // All custom tag slugs
  const customTagSlugs = useMemo(() => customTags.map((t) => t.slug), [customTags])

  // Quick filters (collapsed state)
  const quickFilters = (
    <div className="flex flex-wrap items-center gap-1.5">
      <FilterLabel>Status:</FilterLabel>
      <FilterChip label="Active" active={filters.status === 'active'} onClick={() => handleStatusToggle('active')} />
      <FilterChip label="Closed" active={filters.status === 'closed'} onClick={() => handleStatusToggle('closed')} />
      <FilterChip label="Needs Human" active={filters.isHumanTakeover ?? false} onClick={handleHumanTakeoverToggle} />
      <span className="ml-2" />
      <FilterLabel>Type:</FilterLabel>
      {SESSION_TAGS.map((tag) => (
        <FilterChip
          key={tag}
          label={SESSION_TAG_INFO[tag].label}
          active={filters.tags?.includes(tag) ?? false}
          onClick={() => handleTagToggle(tag)}
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
        <FilterChip label="Active" active={filters.status === 'active'} onClick={() => handleStatusToggle('active')} />
        <FilterChip label="Closed" active={filters.status === 'closed'} onClick={() => handleStatusToggle('closed')} />
        <FilterChip label="Needs Human" active={filters.isHumanTakeover ?? false} onClick={handleHumanTakeoverToggle} />
        <span className="ml-2" />
        <FilterLabel>Type:</FilterLabel>
        {SESSION_TAGS.map((tag) => (
          <FilterChip
            key={tag}
            label={SESSION_TAG_INFO[tag].label}
            active={filters.tags?.includes(tag) ?? false}
            onClick={() => handleTagToggle(tag)}
          />
        ))}
        {customTags.length > 0 && (
          <>
            <span className="ml-2" />
            <FilterLabel>Custom:</FilterLabel>
            {customTags.map((tag) => (
              <FilterChip
                key={tag.slug}
                label={tag.name}
                active={filters.tags?.includes(tag.slug) ?? false}
                onClick={() => handleTagToggle(tag.slug)}
              />
            ))}
          </>
        )}
      </div>

      {/* Row 2: Source + Archived */}
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterLabel>Source:</FilterLabel>
        {(Object.keys(SESSION_SOURCE_INFO) as SessionSource[]).map((source) => (
          <FilterChip
            key={source}
            label={SESSION_SOURCE_INFO[source].label}
            active={filters.source === source}
            onClick={() => handleSourceToggle(source)}
          />
        ))}
        <span className="ml-2" />
        <FilterChip
          label="Archived"
          active={filters.showArchived ?? false}
          onClick={handleArchivedToggle}
        />
      </div>

      {/* Row 3: Project + Dates + Search */}
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
          <FilterLabel>From:</FilterLabel>
          <Input
            type="date"
            value={filters.dateFrom || ''}
            onChange={handleDateFromChange}
            className="h-6 w-32 rounded-full border border-[color:var(--border-subtle)] bg-transparent px-2 py-0 text-[10px]"
          />
        </div>
        <div className="flex items-center gap-1">
          <FilterLabel>To:</FilterLabel>
          <Input
            type="date"
            value={filters.dateTo || ''}
            onChange={handleDateToChange}
            className="h-6 w-32 rounded-full border border-[color:var(--border-subtle)] bg-transparent px-2 py-0 text-[10px]"
          />
        </div>
        <div className="flex items-center gap-1">
          <FilterLabel>User:</FilterLabel>
          <Input
            type="text"
            placeholder="ID..."
            value={filters.userId || ''}
            onChange={handleUserIdChange}
            className="h-6 w-24 rounded-full border border-[color:var(--border-subtle)] bg-transparent px-2 py-0 text-[10px]"
          />
        </div>
        <div className="flex items-center gap-1">
          <FilterLabel>Session:</FilterLabel>
          <Input
            type="text"
            placeholder="ID..."
            value={filters.sessionId || ''}
            onChange={handleSessionIdChange}
            className="h-6 w-24 rounded-full border border-[color:var(--border-subtle)] bg-transparent px-2 py-0 text-[10px]"
          />
        </div>
        <div className="flex items-center gap-1">
          <FilterLabel>Name:</FilterLabel>
          <Input
            type="text"
            placeholder="Search..."
            value={filters.name || ''}
            onChange={handleNameChange}
            className="h-6 w-28 rounded-full border border-[color:var(--border-subtle)] bg-transparent px-2 py-0 text-[10px]"
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
