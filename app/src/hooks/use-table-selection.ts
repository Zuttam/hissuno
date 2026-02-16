'use client'

import { useState, useCallback, useMemo } from 'react'

interface UseTableSelectionReturn<T extends { id: string }> {
  selectedIds: Set<string>
  toggleItem: (id: string) => void
  toggleAll: () => void
  clearSelection: () => void
  selectAll: () => void
  isAllSelected: boolean
  isIndeterminate: boolean
  selectedCount: number
  selectedItems: T[]
}

export function useTableSelection<T extends { id: string }>(items: T[]): UseTableSelectionReturn<T> {
  const [rawSelectedIds, setRawSelectedIds] = useState<Set<string>>(new Set())

  // Only keep IDs that exist in the current items list.
  // When items change (page/filter), any stale selections are automatically pruned.
  const itemIds = useMemo(() => new Set(items.map((item) => item.id)), [items])
  const selectedIds = useMemo(() => {
    if (rawSelectedIds.size === 0) return rawSelectedIds
    const filtered = new Set<string>()
    for (const id of rawSelectedIds) {
      if (itemIds.has(id)) filtered.add(id)
    }
    return filtered
  }, [rawSelectedIds, itemIds])

  const toggleItem = useCallback((id: string) => {
    setRawSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setRawSelectedIds((prev) => {
      const currentValid = new Set<string>()
      for (const id of prev) {
        if (itemIds.has(id)) currentValid.add(id)
      }
      if (currentValid.size === items.length && items.length > 0) {
        return new Set()
      }
      return new Set(items.map((item) => item.id))
    })
  }, [items, itemIds])

  const clearSelection = useCallback(() => {
    setRawSelectedIds(new Set())
  }, [])

  const selectAll = useCallback(() => {
    setRawSelectedIds(new Set(items.map((item) => item.id)))
  }, [items])

  const isAllSelected = items.length > 0 && selectedIds.size === items.length
  const isIndeterminate = selectedIds.size > 0 && selectedIds.size < items.length
  const selectedCount = selectedIds.size

  const selectedItems = useMemo(
    () => items.filter((item) => selectedIds.has(item.id)),
    [items, selectedIds]
  )

  return useMemo(
    () => ({
      selectedIds,
      toggleItem,
      toggleAll,
      clearSelection,
      selectAll,
      isAllSelected,
      isIndeterminate,
      selectedCount,
      selectedItems,
    }),
    [selectedIds, toggleItem, toggleAll, clearSelection, selectAll, isAllSelected, isIndeterminate, selectedCount, selectedItems]
  )
}
