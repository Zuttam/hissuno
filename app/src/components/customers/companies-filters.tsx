'use client'

import { useCallback, useMemo } from 'react'
import { Input, CollapsibleSection, Button, FilterChip, FilterLabel } from '@/components/ui'
import type { CompanyFilters, CompanyStage } from '@/types/customer'
import { COMPANY_STAGES } from '@/types/customer'

interface CompaniesFiltersProps {
  filters: CompanyFilters
  onFilterChange: (filters: CompanyFilters) => void
}

const STAGE_LABELS: Record<CompanyStage, string> = {
  prospect: 'Prospect',
  onboarding: 'Onboarding',
  active: 'Active',
  churned: 'Churned',
  expansion: 'Expansion',
}

export function CompaniesFilters({
  filters,
  onFilterChange,
}: CompaniesFiltersProps) {
  const handleStageToggle = useCallback(
    (stage: CompanyStage) => {
      onFilterChange({
        ...filters,
        stage: filters.stage === stage ? undefined : stage,
      })
    },
    [filters, onFilterChange]
  )

  const handleArchivedToggle = useCallback(() => {
    onFilterChange({ ...filters, showArchived: !filters.showArchived || undefined })
  }, [filters, onFilterChange])

  const handleSearchChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange({ ...filters, search: e.target.value || undefined })
    },
    [filters, onFilterChange]
  )

  const handleIndustryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange({ ...filters, industry: e.target.value || undefined })
    },
    [filters, onFilterChange]
  )

  const handlePlanTierChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange({ ...filters, planTier: e.target.value || undefined })
    },
    [filters, onFilterChange]
  )

  const handleCountryChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      onFilterChange({ ...filters, country: e.target.value || undefined })
    },
    [filters, onFilterChange]
  )

  const handleClearFilters = useCallback(() => {
    onFilterChange({})
  }, [onFilterChange])

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.stage) count++
    if (filters.search) count++
    if (filters.industry) count++
    if (filters.planTier) count++
    if (filters.country) count++
    if (filters.showArchived) count++
    return count
  }, [filters])

  const hasActiveFilters = activeFilterCount > 0

  const collapsedSummary = hasActiveFilters
    ? `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active`
    : undefined

  const quickFilters = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex items-center gap-1.5">
        <FilterLabel>Stage:</FilterLabel>
        {(['active', 'prospect', 'onboarding'] as CompanyStage[]).map((stage) => (
          <FilterChip
            key={stage}
            label={STAGE_LABELS[stage]}
            active={filters.stage === stage}
            onClick={() => handleStageToggle(stage)}
          />
        ))}
      </div>
      <div className="flex items-center gap-1 whitespace-nowrap">
        <FilterLabel>Search:</FilterLabel>
        <Input
          type="text"
          placeholder="Search companies..."
          value={filters.search || ''}
          onChange={handleSearchChange}
          className="h-6 w-40 rounded-full border border-[color:var(--border-subtle)] bg-transparent px-2 py-0 text-[10px]"
        />
      </div>
    </div>
  )

  const expandedFilters = (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterLabel>Stage:</FilterLabel>
        {COMPANY_STAGES.map((stage) => (
          <FilterChip
            key={stage}
            label={STAGE_LABELS[stage]}
            active={filters.stage === stage}
            onClick={() => handleStageToggle(stage)}
          />
        ))}
        <span className="ml-2" />
        <FilterChip
          label="Archived"
          active={filters.showArchived ?? false}
          onClick={handleArchivedToggle}
        />
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1 whitespace-nowrap">
          <FilterLabel>Search:</FilterLabel>
          <Input
            type="text"
            placeholder="Search companies..."
            value={filters.search || ''}
            onChange={handleSearchChange}
            className="h-6 w-40 rounded-full border border-[color:var(--border-subtle)] bg-transparent px-2 py-0 text-[10px]"
          />
        </div>
        <div className="flex items-center gap-1 whitespace-nowrap">
          <FilterLabel>Industry:</FilterLabel>
          <Input
            type="text"
            placeholder="Filter by industry..."
            value={filters.industry || ''}
            onChange={handleIndustryChange}
            className="h-6 w-32 rounded-full border border-[color:var(--border-subtle)] bg-transparent px-2 py-0 text-[10px]"
          />
        </div>
        <div className="flex items-center gap-1 whitespace-nowrap">
          <FilterLabel>Plan Tier:</FilterLabel>
          <Input
            type="text"
            placeholder="Filter by plan..."
            value={filters.planTier || ''}
            onChange={handlePlanTierChange}
            className="h-6 w-32 rounded-full border border-[color:var(--border-subtle)] bg-transparent px-2 py-0 text-[10px]"
          />
        </div>
        <div className="flex items-center gap-1 whitespace-nowrap">
          <FilterLabel>Country:</FilterLabel>
          <Input
            type="text"
            placeholder="Filter by country..."
            value={filters.country || ''}
            onChange={handleCountryChange}
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
