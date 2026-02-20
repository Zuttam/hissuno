'use client'

import { useCallback, useMemo } from 'react'
import Image from 'next/image'
import { MessageSquare, Code2, PenLine } from 'lucide-react'
import { Input, Select, CollapsibleSection, Button, Combobox, FilterChip, FilterLabel } from '@/components/ui'
import type { SessionFilters, SessionSource } from '@/types/session'
import { SESSION_SOURCE_INFO, SESSION_TAGS, SESSION_TAG_INFO } from '@/types/session'
import type { ProjectRecord } from '@/lib/supabase/projects'
import { useCustomTags } from '@/hooks/use-custom-tags'

const ICON_SIZE = 8

const SOURCE_ICONS: Record<SessionSource, React.ReactNode> = {
  widget: <MessageSquare size={ICON_SIZE} />,
  slack: <Image src="/logos/slack.svg" alt="" width={ICON_SIZE} height={ICON_SIZE} />,
  intercom: <Image src="/logos/intercom.svg" alt="" width={ICON_SIZE} height={ICON_SIZE} />,
  zendesk: (
    <>
      <Image src="/logos/zendesk.svg" alt="" width={ICON_SIZE} height={ICON_SIZE} className="dark:hidden" />
      <Image src="/logos/zendesk-dark.svg" alt="" width={ICON_SIZE} height={ICON_SIZE} className="hidden dark:block" />
    </>
  ),
  gong: <Image src="/logos/gong.svg" alt="" width={ICON_SIZE} height={ICON_SIZE} />,
  api: <Code2 size={ICON_SIZE} />,
  manual: <PenLine size={ICON_SIZE} />,
}

interface SessionsFiltersProps {
  projects: ProjectRecord[]
  filters: SessionFilters
  onFilterChange: (filters: SessionFilters) => void
  hideProjectFilter?: boolean
  companies?: { id: string; name: string }[]
  contacts?: { id: string; name: string }[]
}


export function SessionsFilters({
  projects,
  filters,
  onFilterChange,
  hideProjectFilter = false,
  companies,
  contacts,
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

  // Analyzed handler
  const handleAnalyzedToggle = useCallback(() => {
    onFilterChange({ ...filters, isAnalyzed: !filters.isAnalyzed || undefined })
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

  const handleCompanySelect = useCallback(
    (companyId: string | undefined) => {
      onFilterChange({ ...filters, companyId })
    },
    [filters, onFilterChange]
  )

  const handleContactSelect = useCallback(
    (contactId: string | undefined) => {
      onFilterChange({ ...filters, contactId })
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
    if (filters.isAnalyzed) count++
    if (filters.tags && filters.tags.length > 0) count++
    if (filters.companyId) count++
    if (filters.contactId) count++
    return count
  }, [filters])

  const hasActiveFilters = activeFilterCount > 0

  const collapsedSummary = hasActiveFilters
    ? `${activeFilterCount} filter${activeFilterCount === 1 ? '' : 's'} active`
    : undefined

  // All custom tag slugs
  const customTagSlugs = useMemo(() => customTags.map((t) => t.slug), [customTags])

  const companyItems = useMemo(
    () => (companies ?? []).map((c) => ({ value: c.id, label: c.name })),
    [companies]
  )

  const contactItems = useMemo(
    () => (contacts ?? []).map((c) => ({ value: c.id, label: c.name })),
    [contacts]
  )

  // Quick filters (collapsed state)
  const quickFilters = (
    <div className="flex flex-wrap items-center gap-1.5">
      <FilterLabel>Status:</FilterLabel>
      <FilterChip label="Active" active={filters.status === 'active'} onClick={() => handleStatusToggle('active')} />
      <FilterChip label="Closed" active={filters.status === 'closed'} onClick={() => handleStatusToggle('closed')} />
      <FilterChip label="Needs Human" active={filters.isHumanTakeover ?? false} onClick={handleHumanTakeoverToggle} />
      <FilterChip label="Analyzed" active={filters.isAnalyzed ?? false} onClick={handleAnalyzedToggle} />
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
        <FilterChip label="Analyzed" active={filters.isAnalyzed ?? false} onClick={handleAnalyzedToggle} />
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
            icon={SOURCE_ICONS[source]}
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
        {contactItems.length > 0 && (
          <div className="flex items-center gap-1 whitespace-nowrap">
            <FilterLabel>Contact:</FilterLabel>
            <Combobox
              items={contactItems}
              value={filters.contactId}
              onValueChange={handleContactSelect}
              placeholder="Filter by contact..."
              emptyMessage="No matches"
              size="sm"
            />
          </div>
        )}
        <div className="flex items-center gap-1">
          <FilterLabel>Feedback:</FilterLabel>
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
