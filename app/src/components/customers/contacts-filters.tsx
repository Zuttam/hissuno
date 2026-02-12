'use client'

import { useCallback, useMemo } from 'react'
import { Input, CollapsibleSection, Button, Combobox, FilterChip, FilterLabel } from '@/components/ui'
import type { ContactFilters } from '@/types/customer'

interface ContactsFiltersProps {
  filters: ContactFilters
  onFilterChange: (filters: ContactFilters) => void
  companies?: { id: string; name: string }[]
}

export function ContactsFilters({
  filters,
  onFilterChange,
  companies,
}: ContactsFiltersProps) {
  const handleChampionToggle = useCallback(() => {
    onFilterChange({
      ...filters,
      isChampion: filters.isChampion === true ? undefined : true,
    })
  }, [filters, onFilterChange])

  const handleArchivedToggle = useCallback(() => {
    onFilterChange({ ...filters, showArchived: !filters.showArchived || undefined })
  }, [filters, onFilterChange])

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange({ ...filters, search: e.target.value || undefined })
    },
    [filters, onFilterChange]
  )

  const handleRoleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange({ ...filters, role: e.target.value || undefined })
    },
    [filters, onFilterChange]
  )

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange({ ...filters, title: e.target.value || undefined })
    },
    [filters, onFilterChange]
  )

  const handleCompanySelect = useCallback(
    (companyId: string | undefined) => {
      onFilterChange({ ...filters, companyId })
    },
    [filters, onFilterChange]
  )

  const handleClearFilters = useCallback(() => {
    onFilterChange({})
  }, [onFilterChange])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.isChampion) count++
    if (filters.search) count++
    if (filters.role) count++
    if (filters.title) count++
    if (filters.companyId) count++
    if (filters.showArchived) count++
    return count
  }, [filters])

  const hasActiveFilters = activeFilterCount > 0

  const collapsedSummary = hasActiveFilters
    ? `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active`
    : undefined

  const companyItems = useMemo(
    () => (companies ?? []).map((c) => ({ value: c.id, label: c.name })),
    [companies]
  )

  const quickFilters = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-1 whitespace-nowrap">
        <FilterLabel>Champions:</FilterLabel>
        <FilterChip
          label="Champions"
          active={filters.isChampion === true}
          onClick={handleChampionToggle}
        />
      </div>
      <div className="flex items-center gap-1 whitespace-nowrap">
        <FilterLabel>Search:</FilterLabel>
        <Input
          type="text"
          placeholder="Search contacts..."
          value={filters.search || ''}
          onChange={handleSearchChange}
          className="h-6 w-40 rounded-full border border-[color:var(--border-subtle)] bg-transparent px-2 py-0 text-[10px]"
        />
      </div>
      {companyItems.length > 0 && (
        <div className="flex items-center gap-1 whitespace-nowrap">
          <FilterLabel>Company:</FilterLabel>
          <Combobox
            items={companyItems}
            value={filters.companyId}
            onValueChange={handleCompanySelect}
            placeholder="Filter by company..."
            emptyMessage="No matches"
            size="sm"
          />
        </div>
      )}
    </div>
  )

  const expandedFilters = (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1 whitespace-nowrap">
          <FilterLabel>Champions:</FilterLabel>
          <FilterChip
            label="Champions"
            active={filters.isChampion === true}
            onClick={handleChampionToggle}
          />
        </div>
        <div className="flex items-center gap-1 whitespace-nowrap">
          <FilterLabel>Archived:</FilterLabel>
          <FilterChip
            label="Archived"
            active={filters.showArchived ?? false}
            onClick={handleArchivedToggle}
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1 whitespace-nowrap">
          <FilterLabel>Search:</FilterLabel>
          <Input
            type="text"
            placeholder="Search contacts..."
            value={filters.search || ''}
            onChange={handleSearchChange}
            className="h-6 w-40 rounded-full border border-[color:var(--border-subtle)] bg-transparent px-2 py-0 text-[10px]"
          />
        </div>
        {companyItems.length > 0 && (
          <div className="flex items-center gap-1 whitespace-nowrap">
            <FilterLabel>Company:</FilterLabel>
            <Combobox
              items={companyItems}
              value={filters.companyId}
              onValueChange={handleCompanySelect}
              placeholder="Filter by company..."
              emptyMessage="No matches"
              size="sm"
            />
          </div>
        )}
        <div className="flex items-center gap-1 whitespace-nowrap">
          <FilterLabel>Role:</FilterLabel>
          <Input
            type="text"
            placeholder="Filter by role..."
            value={filters.role || ''}
            onChange={handleRoleChange}
            className="h-6 w-32 rounded-full border border-[color:var(--border-subtle)] bg-transparent px-2 py-0 text-[10px]"
          />
        </div>
        <div className="flex items-center gap-1 whitespace-nowrap">
          <FilterLabel>Title:</FilterLabel>
          <Input
            type="text"
            placeholder="Filter by title..."
            value={filters.title || ''}
            onChange={handleTitleChange}
            className="h-6 w-32 rounded-full border border-[color:var(--border-subtle)] bg-transparent px-2 py-0 text-[10px]"
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
