'use client'

import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import type { KnowledgeSourceWithCodebase } from '@/lib/knowledge/types'
import type { ProductScopeRecord } from '@/types/product-scope'
import { KnowledgeTreeNode } from './knowledge-tree-node'

interface KnowledgeSourceTreeProps {
  sources: KnowledgeSourceWithCodebase[]
  selectedSourceId: string | null
  onSelect: (sourceId: string) => void
  onUpdate: (sourceId: string, updates: Record<string, unknown>) => Promise<boolean>
  onDelete: (sourceId: string, options?: { children?: 'reparent' | 'delete' }) => Promise<boolean>
  onCreateFolder: (parentId?: string | null) => void
  productScopes?: ProductScopeRecord[]
  githubConnected?: boolean
}

export function KnowledgeSourceTree({
  sources,
  selectedSourceId,
  onSelect,
  onUpdate,
  onDelete,
  onCreateFolder,
  productScopes,
}: KnowledgeSourceTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() =>
    new Set(sources.filter(s => s.type === 'folder').map(s => s.id))
  )

  // Auto-expand newly added folders
  const prevSourceIdsRef = useRef<Set<string>>(new Set(sources.map(s => s.id)))
  useEffect(() => {
    const prevIds = prevSourceIdsRef.current
    const newFolders = sources.filter(s => s.type === 'folder' && !prevIds.has(s.id))
    if (newFolders.length > 0) {
      setExpandedIds(prev => {
        const next = new Set(prev)
        for (const f of newFolders) next.add(f.id)
        return next
      })
    }
    prevSourceIdsRef.current = new Set(sources.map(s => s.id))
  }, [sources])

  const childrenMap = useMemo(() => {
    const map = new Map<string | null, KnowledgeSourceWithCodebase[]>()
    for (const source of sources) {
      const parentKey = source.parent_id ?? null
      if (!map.has(parentKey)) map.set(parentKey, [])
      map.get(parentKey)!.push(source)
    }
    for (const children of map.values()) {
      children.sort((a, b) => {
        const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0)
        if (orderDiff !== 0) return orderDiff
        return (a.name ?? '').localeCompare(b.name ?? '')
      })
    }
    return map
  }, [sources])

  const descendantCounts = useMemo(() => {
    const counts = new Map<string, number>()
    function count(id: string): number {
      const children = childrenMap.get(id) ?? []
      let total = children.length
      for (const child of children) total += count(child.id)
      counts.set(id, total)
      return total
    }
    for (const source of sources) {
      if (!counts.has(source.id)) count(source.id)
    }
    return counts
  }, [sources, childrenMap])

  const sourceMap = useMemo(
    () => new Map(sources.map(s => [s.id, s])),
    [sources]
  )

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const getAncestorIds = useCallback((sourceId: string): string[] => {
    const ancestors: string[] = []
    let current = sourceMap.get(sourceId)
    while (current?.parent_id) {
      ancestors.push(current.parent_id)
      current = sourceMap.get(current.parent_id)
    }
    return ancestors
  }, [sourceMap])

  const handleDrop = useCallback(async (
    draggedId: string,
    targetId: string | null,
    position: 'inside' | 'before' | 'after',
  ) => {
    if (position === 'inside') {
      await onUpdate(draggedId, { parent_id: targetId })
      if (targetId) {
        setExpandedIds(prev => new Set([...prev, targetId]))
      }
    } else {
      const targetSource = sourceMap.get(targetId!)
      const parentId = targetSource?.parent_id ?? null
      const siblings = childrenMap.get(parentId) ?? []
      const targetIndex = siblings.findIndex(s => s.id === targetId)
      const insertIndex = position === 'after' ? targetIndex + 1 : targetIndex

      await onUpdate(draggedId, {
        parent_id: parentId,
        sort_order: insertIndex,
      })
    }
  }, [onUpdate, sourceMap, childrenMap])

  const rootItems = childrenMap.get(null) ?? []

  return (
    <div className="flex flex-col gap-0.5">
      {rootItems.map(source => (
        <KnowledgeTreeNode
          key={source.id}
          source={source}
          depth={0}
          childrenMap={childrenMap}
          descendantCounts={descendantCounts}
          expandedIds={expandedIds}
          selectedSourceId={selectedSourceId}
          onSelect={onSelect}
          onToggleExpand={toggleExpand}
          onUpdate={onUpdate}
          onDelete={onDelete}
          onCreateFolder={onCreateFolder}
          onDrop={handleDrop}
          getAncestorIds={getAncestorIds}
          productScopes={productScopes}
        />
      ))}

      {sources.length === 0 && (
        <p className="text-sm text-[color:var(--text-tertiary)] py-4 text-center">
          No knowledge yet. Add your first source or create a folder.
        </p>
      )}
    </div>
  )
}
