'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useProject } from '@/components/providers/project-provider'
import { useResourceTree } from '@/hooks/use-resource-tree'
import type { ResourceGroupType, ResourceGroupItem } from './resource-tree-types'
import { RESOURCE_GROUPS } from './resource-tree-types'
import { SidebarSearchInput } from './sidebar-search-input'
import { SidebarSearchResults } from './sidebar-search-results'
import { ResourceGroup } from './resource-group'

const STORAGE_KEY = 'hissuno-sidebar-tree-expanded'

function loadExpandedGroups(): Set<ResourceGroupType> {
  if (typeof window === 'undefined') return new Set()
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return new Set(JSON.parse(stored))
  } catch { /* ignore */ }
  return new Set()
}

function saveExpandedGroups(groups: Set<ResourceGroupType>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...groups]))
  } catch { /* ignore */ }
}

interface SidebarResourceTreeProps {
  isCollapsed: boolean
  onNavigate?: () => void
}

export function SidebarResourceTree({ isCollapsed, onNavigate }: SidebarResourceTreeProps) {
  const { projectId } = useProject()
  const router = useRouter()
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedGroups, setExpandedGroups] = useState<Set<ResourceGroupType>>(loadExpandedGroups)
  const { groups } = useResourceTree(projectId, expandedGroups)

  // Persist expanded groups
  useEffect(() => {
    saveExpandedGroups(expandedGroups)
  }, [expandedGroups])

  // Clear search when project changes
  useEffect(() => {
    setSearchQuery('')
  }, [projectId])

  const toggleGroup = useCallback((type: ResourceGroupType) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  const handleItemClick = useCallback((item: ResourceGroupItem) => {
    if (!projectId) return
    const base = `/projects/${projectId}`
    switch (item.type) {
      case 'issues': router.push(`${base}/issues/${item.id}`); break
      case 'feedback': router.push(`${base}/sessions/${item.id}`); break
      case 'customers': router.push(`${base}/customers/${item.subtype === 'contact' ? 'contacts' : 'companies'}/${item.id}`); break
      case 'scopes': router.push(`${base}/products`); break
    }
    onNavigate?.()
  }, [projectId, router, onNavigate])

  if (isCollapsed) return null

  const isSearching = searchQuery.trim().length > 0

  return (
    <div className="flex flex-1 flex-col gap-0 min-h-0">
      <SidebarSearchInput value={searchQuery} onChange={setSearchQuery} />
      <div className="flex-1 overflow-y-auto px-1.5 pb-2">
        {isSearching && projectId ? (
          <SidebarSearchResults
            query={searchQuery}
            projectId={projectId}
            selectedItemId={null}
            onItemClick={handleItemClick}
          />
        ) : (
          <div className="flex flex-col gap-1">
            {RESOURCE_GROUPS.map((group) => (
              <ResourceGroup
                key={group.type}
                label={group.label}
                isExpanded={expandedGroups.has(group.type)}
                onToggle={() => toggleGroup(group.type)}
                items={groups[group.type].items}
                total={groups[group.type].total}
                isLoading={groups[group.type].isLoading}
                selectedItemId={null}
                onItemClick={handleItemClick}
                pageHref={group.pageHref}
                projectId={projectId ?? ''}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
