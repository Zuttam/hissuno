'use client'

import { useEffect, useState } from 'react'
import { useDebounce } from '@/hooks/use-debounce'
import { searchResources, type SearchResult } from '@/lib/api/search'
import type { ResourceGroupType, ResourceGroupItem } from './resource-tree-types'
import { RESOURCE_GROUPS } from './resource-tree-types'
import { ResourceGroup } from './resource-group'

const TYPE_MAP: Record<string, ResourceGroupType> = {
  issues: 'issues',
  feedback: 'feedback',
  customers: 'customers',
  knowledge: 'knowledge',
  scopes: 'scopes',
}

function groupResults(results: SearchResult[]): Record<ResourceGroupType, ResourceGroupItem[]> {
  const grouped: Record<ResourceGroupType, ResourceGroupItem[]> = {
    issues: [],
    feedback: [],
    customers: [],
    knowledge: [],
    scopes: [],
  }

  for (const r of results) {
    const groupType = TYPE_MAP[r.type]
    if (!groupType) continue
    grouped[groupType].push({
      id: r.id,
      name: r.name,
      subtitle: r.snippet || undefined,
      type: groupType,
      subtype: r.subtype,
    })
  }

  return grouped
}

interface SidebarSearchResultsProps {
  query: string
  projectId: string
  selectedItemId: string | null
  onItemClick: (item: ResourceGroupItem) => void
}

export function SidebarSearchResults({ query, projectId, selectedItemId, onItemClick }: SidebarSearchResultsProps) {
  const debouncedQuery = useDebounce(query, 300)
  const [results, setResults] = useState<Record<ResourceGroupType, ResourceGroupItem[]> | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!debouncedQuery.trim() || !projectId) {
      setResults(null)
      return
    }

    let cancelled = false
    setIsLoading(true)

    searchResources(projectId, debouncedQuery.trim(), { mode: 'keyword', limit: 10 })
      .then((res) => {
        if (!cancelled) {
          setResults(groupResults(res.results))
          setIsLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults(null)
          setIsLoading(false)
        }
      })

    return () => { cancelled = true }
  }, [debouncedQuery, projectId])

  if (isLoading) {
    return (
      <div className="flex items-center gap-1.5 px-4 py-3">
        <div className="h-3 w-3 animate-spin rounded-full border border-[color:var(--text-tertiary)] border-t-transparent" />
        <span className="text-xs text-[color:var(--text-tertiary)]">Searching...</span>
      </div>
    )
  }

  if (!results) return null

  const hasAnyResults = Object.values(results).some((items) => items.length > 0)

  if (!hasAnyResults) {
    return (
      <div className="px-4 py-3 text-xs text-[color:var(--text-tertiary)]">
        No results for &ldquo;{debouncedQuery}&rdquo;
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1 px-1.5">
      {RESOURCE_GROUPS.map((group) => {
        const items = results[group.type]
        if (items.length === 0) return null
        return (
          <ResourceGroup
            key={group.type}
            label={group.label}
            isExpanded
            onToggle={() => {}}
            items={items}
            total={items.length}
            isLoading={false}
            selectedItemId={selectedItemId}
            onItemClick={onItemClick}
            pageHref={group.pageHref}
            projectId={projectId}
          />
        )
      })}
    </div>
  )
}
