'use client'

import { useMemo, useState, useCallback } from 'react'
import { Badge } from '@/components/ui'
import { ScopeTypeIcon } from '@/components/projects/products/product-scope-sidebar'
import type { ProductScopeRecord } from '@/types/product-scope'
import type { TagColorVariant } from '@/types/session'

const MAX_SCOPES = 50

interface ProductScopeListProps {
  scopes: ProductScopeRecord[]
  selectedScopeId: string | null
  onSelect: (scopeId: string) => void
  searchQuery: string
}

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`h-3.5 w-3.5 shrink-0 transition-transform text-[color:var(--text-tertiary)] ${expanded ? 'rotate-90' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="m9 5 7 7-7 7" />
    </svg>
  )
}

function ScopeTreeNode({
  scope,
  childrenMap,
  descendantCounts,
  expandedIds,
  selectedScopeId,
  onSelect,
  onToggleExpand,
  depth,
}: {
  scope: ProductScopeRecord
  childrenMap: Map<string | null, ProductScopeRecord[]>
  descendantCounts: Map<string, number>
  expandedIds: Set<string>
  selectedScopeId: string | null
  onSelect: (scopeId: string) => void
  onToggleExpand: (id: string) => void
  depth: number
}) {
  const children = childrenMap.get(scope.id) ?? []
  const hasChildren = children.length > 0
  const isExpanded = expandedIds.has(scope.id)
  const count = descendantCounts.get(scope.id) ?? 0

  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(scope.id)}
        style={{ paddingLeft: depth * 20 }}
        className={`flex w-full items-center gap-2 rounded-lg p-3 text-left transition ${
          selectedScopeId === scope.id
            ? 'bg-[color:var(--surface-selected)] ring-1 ring-[color:var(--accent-selected)]'
            : 'bg-[color:var(--background-secondary)] hover:bg-[color:var(--surface-hover)]'
        }`}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleExpand(scope.id) }}
            className="shrink-0 p-0.5 -m-0.5 rounded-[2px] hover:bg-[color:var(--surface-hover)]"
          >
            <ChevronIcon expanded={isExpanded} />
          </button>
        ) : (
          <span className="w-3.5 shrink-0" />
        )}
        <ScopeTypeIcon type={scope.type} size={16} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2">
            <Badge variant={scope.color as TagColorVariant}>{scope.name}</Badge>
            {scope.is_default && (
              <span className="text-xs text-[color:var(--text-tertiary)]">(default)</span>
            )}
            {hasChildren && (
              <span className="text-[10px] tabular-nums text-[color:var(--text-tertiary)]">{count}</span>
            )}
          </div>
          {scope.description && (
            <p className="line-clamp-2 text-xs text-[color:var(--text-secondary)]">
              {scope.description}
            </p>
          )}
          {scope.goals && scope.goals.length > 0 && (
            <p className="text-xs text-[color:var(--text-tertiary)]">
              {scope.goals.length} goal{scope.goals.length !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </button>
      {hasChildren && isExpanded && (
        <div className="flex flex-col gap-2 mt-2">
          {children.map((child) => (
            <ScopeTreeNode
              key={child.id}
              scope={child}
              childrenMap={childrenMap}
              descendantCounts={descendantCounts}
              expandedIds={expandedIds}
              selectedScopeId={selectedScopeId}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ProductScopeList({
  scopes,
  selectedScopeId,
  onSelect,
  searchQuery,
}: ProductScopeListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(scopes.filter(s => s.parent_id === null).map(s => s.id))
  )

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const isSearching = searchQuery.trim().length > 0

  const filtered = isSearching
    ? scopes.filter((a) => a.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
    : scopes

  const childrenMap = useMemo(() => {
    const map = new Map<string | null, ProductScopeRecord[]>()
    for (const scope of scopes) {
      const parentKey = scope.parent_id ?? null
      if (!map.has(parentKey)) map.set(parentKey, [])
      map.get(parentKey)!.push(scope)
    }
    for (const children of map.values()) {
      children.sort((a, b) => a.position - b.position)
    }
    return map
  }, [scopes])

  const descendantCounts = useMemo(() => {
    const counts = new Map<string, number>()
    function count(id: string): number {
      const children = childrenMap.get(id) ?? []
      let total = children.length
      for (const child of children) total += count(child.id)
      counts.set(id, total)
      return total
    }
    for (const scope of scopes) {
      if (!counts.has(scope.id)) count(scope.id)
    }
    return counts
  }, [scopes, childrenMap])

  const rootItems = childrenMap.get(null) ?? []

  return (
    <div className="flex flex-col gap-2">
      {filtered.length === 0 && (
        <p className="py-8 text-center text-sm text-[color:var(--text-tertiary)]">
          {isSearching
            ? 'No product scopes match your search.'
            : 'No product scopes defined yet. Click "Add Scope" above to get started.'}
        </p>
      )}

      {isSearching ? (
        // Flat list when searching
        filtered.map((scope) => (
          <ScopeTreeNode
            key={scope.id}
            scope={scope}
            childrenMap={new Map()}
            descendantCounts={new Map()}
            expandedIds={new Set()}
            selectedScopeId={selectedScopeId}
            onSelect={onSelect}
            onToggleExpand={() => {}}
            depth={0}
          />
        ))
      ) : (
        // Tree view normally
        rootItems.map((scope) => (
          <ScopeTreeNode
            key={scope.id}
            scope={scope}
            childrenMap={childrenMap}
            descendantCounts={descendantCounts}
            expandedIds={expandedIds}
            selectedScopeId={selectedScopeId}
            onSelect={onSelect}
            onToggleExpand={toggleExpand}
            depth={0}
          />
        ))
      )}

      {/* Scope count */}
      <div className="flex items-center justify-end pt-1">
        <span className="text-xs text-[color:var(--text-tertiary)]">
          {scopes.length} / {MAX_SCOPES}
        </span>
      </div>
    </div>
  )
}
